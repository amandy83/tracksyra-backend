import { randomUUID } from "node:crypto";
import { Contributor, DistributionVersion, Release, ReleaseId, ReleaseVersion, TerritorySet, Track } from "../domain";
import type { DistributionRelease, DistributionTrack } from "../models/distributionTypes";
import type { DistributionStore, SqlExecutor } from "../services/distributionStore";
import type { ReleaseDeliveryEngine } from "../core/releaseDeliveryEngine";
import type { EnterpriseOperationsService } from "../admin/enterpriseOperationsService";
import type { EnterpriseDistributionService } from "../admin/enterpriseDistributionService";
import type { MetadataIntelligenceEngine } from "../intelligence/metadata";
import { QueueDispatcher } from "../../queue/queueDispatcher";
import { queueNames } from "../../queue/queueNames";
import { incrementMetric, recordRetry, setWorkerHealth } from "../../queue/metrics";
import { logger as defaultLogger, type Logger } from "../../observability/logger";

export type ReleaseWorkflowState = "draft" | "scheduled" | "locked" | "approved" | "running" | "delivered" | "failed" | "cancelled" | "rolled_back" | "restored";

export type ReleaseAutomationDependencies = Readonly<{
  sql: SqlExecutor;
  distributionStore: DistributionStore;
  releaseDeliveryEngine: ReleaseDeliveryEngine | null;
  enterpriseOperationsService: EnterpriseOperationsService;
  enterpriseDistributionService: EnterpriseDistributionService;
  metadataIntelligenceEngine?: MetadataIntelligenceEngine | null;
  logger?: Logger | null;
  now?: () => string;
}>;

export type ReleaseAutomationScheduleInput = Readonly<{
  releaseId: string;
  trackId?: string | null;
  scheduledFor?: string | Date | null;
  timezone?: string | null;
  embargoUntil?: string | Date | null;
  priority?: number | null;
  freeze?: boolean;
  release?: DistributionRelease | null;
  track?: DistributionTrack | null;
  metadata?: Readonly<Record<string, unknown>>;
}>;

export type ReleaseAutomationOrchestrationInput = Readonly<{
  releaseId: string;
  trackId?: string | null;
  targets?: readonly string[];
  parallel?: boolean;
  sequential?: boolean;
  batchId?: string | null;
  dependencyReleaseIds?: readonly string[];
  release?: DistributionRelease | null;
  track?: DistributionTrack | null;
  metadata?: Readonly<Record<string, unknown>>;
}>;

export type ReleaseAutomationApprovalInput = Readonly<{
  releaseId: string;
  trackId?: string | null;
  approved: boolean;
  approverId?: string | null;
  notes?: string | null;
  metadata?: Readonly<Record<string, unknown>>;
}>;

export type ReleaseAutomationReport = Readonly<{
  generatedAt: string;
  name: string;
  items: readonly unknown[];
  summary: Readonly<Record<string, unknown>>;
}>;

const DEFAULT_TARGETS = Object.freeze(["spotify", "apple_music", "youtube_music"] as const);
const ALLOWED_STATES: ReadonlyMap<ReleaseWorkflowState, readonly ReleaseWorkflowState[]> = new Map([
  ["draft", ["scheduled", "locked", "cancelled"]],
  ["scheduled", ["locked", "approved", "running", "cancelled"]],
  ["locked", ["approved", "running", "cancelled"]],
  ["approved", ["running", "cancelled"]],
  ["running", ["delivered", "failed", "rolled_back", "cancelled"]],
  ["delivered", ["rolled_back", "restored"]],
  ["failed", ["running", "rolled_back", "cancelled"]],
  ["cancelled", []],
  ["rolled_back", ["restored"]],
  ["restored", ["approved", "running", "cancelled"]],
]);

function nowIso(now?: () => string): string {
  return now ? now() : new Date().toISOString();
}

function freeze<T>(value: T): T {
  if (Array.isArray(value)) return Object.freeze([...value]) as T;
  if (value && typeof value === "object") return Object.freeze({ ...(value as Record<string, unknown>) }) as T;
  return value;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asDateString(value: string | Date | null | undefined): string | null {
  if (value == null) return null;
  return value instanceof Date ? value.toISOString() : value;
}

function localMidnight(dateValue: string | Date, timeZone: string): string {
  const input = dateValue instanceof Date ? dateValue : new Date(dateValue);
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(formatter.formatToParts(input).map((part) => [part.type, part.value]));
  const local = `${parts.year}-${parts.month}-${parts.day}T00:00:00`;
  const localDate = new Date(`${local}Z`);
  const adjusted = new Date(localDate.toLocaleString("en-US", { timeZone }));
  return adjusted.toISOString();
}

function toTargetList(value: readonly string[] | undefined): readonly string[] {
  return freeze((value && value.length ? value : [...DEFAULT_TARGETS]).map((entry) => entry.trim()).filter(Boolean));
}

export class ReleaseAutomationEngine {
  private readonly log: Logger;

  constructor(private readonly deps: ReleaseAutomationDependencies) {
    this.log = deps.logger ?? defaultLogger.child({ component: "release-automation-engine" });
    this.log.debug("Release automation engine initialized");
  }

  async scheduleRelease(input: ReleaseAutomationScheduleInput): Promise<Readonly<Record<string, unknown>>> {
    const source = await this.resolveSource(input.releaseId, input.release, input.track, input.trackId ?? null);
    const release = source.release;
    const track = source.track;
    const scheduleAt = input.scheduledFor ? asDateString(input.scheduledFor) : release.releaseDate ? localMidnight(release.releaseDate, input.timezone ?? "UTC") : nowIso(this.deps.now);
    const state: ReleaseWorkflowState = input.freeze ? "locked" : "scheduled";
    await this.persistWorkflow({
      releaseId: release.id,
      trackId: track?.id ?? null,
      state,
      scheduledFor: scheduleAt,
      priority: input.priority ?? 50,
      embargoUntil: asDateString(input.embargoUntil),
      batchId: null,
      metadata: input.metadata ?? {},
    });
    await this.persistVersion(release.id, track?.id ?? null, state, freeze({ scheduleAt, embargoUntil: asDateString(input.embargoUntil), priority: input.priority ?? 50 }));
    await this.persistEvent(release.id, track?.id ?? null, "release.scheduled", state, freeze({ scheduleAt, embargoUntil: asDateString(input.embargoUntil), priority: input.priority ?? 50 }));
    await this.persistHealth(release.id, track?.id ?? null, "scheduled", state, freeze({ scheduleAt, embargoUntil: asDateString(input.embargoUntil), priority: input.priority ?? 50 }));
    if (input.freeze) {
      await this.persistLock(release.id, track?.id ?? null, "freeze", input.metadata ?? {});
    }
    await this.recordAudit(release.id, "RELEASE_SCHEDULED", state === "locked" ? "LOCKED" : "SCHEDULED", input.metadata ?? {}, track?.id ?? null);
    QueueDispatcher.enqueueReleaseScheduler({
      type: "SCHEDULE_RELEASE",
      releaseId: release.id,
      trackId: track?.id ?? null,
      scheduledFor: scheduleAt,
      timezone: input.timezone ?? null,
      embargoUntil: input.embargoUntil ?? null,
      priority: input.priority ?? 50,
      release,
      track,
      metadata: input.metadata ?? {},
      actorUserId: release.userId,
      correlationId: `schedule:${release.id}`,
      sourceSystem: "distribution",
      idempotencyKey: `release:schedule:${release.id}:${track?.id ?? "release"}`,
      createdAt: nowIso(this.deps.now),
    });
    return freeze({
      releaseId: release.id,
      trackId: track?.id ?? null,
      state,
      scheduledFor: scheduleAt,
      embargoUntil: asDateString(input.embargoUntil),
      priority: input.priority ?? 50,
    });
  }

  async approveRelease(input: ReleaseAutomationApprovalInput): Promise<Readonly<Record<string, unknown>>> {
    const source = await this.resolveSource(input.releaseId, null, null, input.trackId ?? null);
    const release = source.release;
    const track = source.track;
    const nextState: ReleaseWorkflowState = input.approved ? "approved" : "cancelled";
    await this.persistState(release.id, track?.id ?? null, nextState, input.metadata ?? {});
    await this.persistVersion(release.id, track?.id ?? null, nextState, freeze({ approved: input.approved, approverId: input.approverId ?? null, notes: input.notes ?? null }));
    await this.persistEvent(release.id, track?.id ?? null, "release.approval", nextState, freeze({ approved: input.approved, approverId: input.approverId ?? null, notes: input.notes ?? null }));
    await this.recordAudit(release.id, input.approved ? "RELEASE_APPROVED" : "RELEASE_REJECTED", input.approved ? "APPROVED" : "REJECTED", input.metadata ?? {}, track?.id ?? null);
    QueueDispatcher.enqueueApproval({
      type: "APPROVE_RELEASE",
      releaseId: release.id,
      trackId: track?.id ?? null,
      approved: input.approved,
      approverId: input.approverId ?? null,
      notes: input.notes ?? null,
      release,
      track,
      metadata: input.metadata ?? {},
      actorUserId: input.approverId ?? release.userId,
      correlationId: `approval:${release.id}`,
      sourceSystem: "distribution",
      idempotencyKey: `release:approval:${release.id}:${track?.id ?? "release"}`,
      createdAt: nowIso(this.deps.now),
    });
    return freeze({ releaseId: release.id, trackId: track?.id ?? null, approved: input.approved, state: nextState });
  }

  async orchestrateDelivery(input: ReleaseAutomationOrchestrationInput): Promise<Readonly<Record<string, unknown>>> {
    const source = await this.resolveSource(input.releaseId, input.release, input.track, input.trackId ?? null);
    const release = source.release;
    const track = source.track;
    const batchId = input.batchId ?? `batch_${release.id}_${Date.now().toString(36)}`;
    const targets = toTargetList(input.targets ?? this.inferTargets(release, track));
    const readiness = await this.releaseReadiness(release, track);
    await this.persistDependencies(batchId, release.id, track?.id ?? null, input.dependencyReleaseIds ?? []);
    await this.persistBatch(batchId, release.id, track?.id ?? null, targets, readiness, input.metadata ?? {});
    await this.persistState(release.id, track?.id ?? null, "running", freeze({ batchId, readiness }));
    await this.persistVersion(release.id, track?.id ?? null, "running", freeze({ batchId, readiness, targets, parallel: input.parallel ?? true, sequential: input.sequential ?? false }));
    await this.persistEvent(release.id, track?.id ?? null, "delivery.orchestrated", "running", freeze({ batchId, readiness, targets, parallel: input.parallel ?? true, sequential: input.sequential ?? false }));
    await this.persistSla(release.id, track?.id ?? null, "delivery_orchestration", readiness, freeze({ batchId, targets }));
    await this.persistHealth(release.id, track?.id ?? null, "running", "running", freeze({ batchId, readiness, targets }));
    await this.recordAudit(release.id, "DELIVERY_BATCH_ORCHESTRATED", "RUNNING", freeze({ batchId, targets, readiness }), track?.id ?? null);
    for (const [index, target] of targets.entries()) {
      await this.persistAttempt(batchId, release.id, track?.id ?? null, target, index + 1, "QUEUED", null, {});
      QueueDispatcher.enqueueDeliveryOrchestration({
        type: "ORCHESTRATE_DELIVERY",
        releaseId: release.id,
        trackId: track?.id ?? null,
        batchId,
        targets: [target],
        parallel: input.parallel ?? true,
        sequential: input.sequential ?? false,
        dependencyReleaseIds: input.dependencyReleaseIds ?? [],
        release,
        track,
        metadata: freeze({ ...input.metadata, target, batchId, readiness }),
        actorUserId: release.userId,
        correlationId: `delivery:${batchId}:${target}`,
        sourceSystem: "distribution",
        idempotencyKey: `delivery:orchestrate:${release.id}:${track?.id ?? "release"}:${batchId}:${target}`,
        createdAt: nowIso(this.deps.now),
      });
    }
    return freeze({ releaseId: release.id, trackId: track?.id ?? null, batchId, targets, readiness, parallel: input.parallel ?? true });
  }

  async retryDelivery(input: ReleaseAutomationOrchestrationInput & Readonly<{ attempt?: number | null; error?: unknown }>): Promise<Readonly<Record<string, unknown>>> {
    const source = await this.resolveSource(input.releaseId, input.release, input.track, input.trackId ?? null);
    const release = source.release;
    const track = source.track;
    const attempt = (input as { attempt?: number | null }).attempt ?? 1;
    const nextRetryAt = new Date(Date.now() + 2 ** Math.max(0, attempt - 1) * 60_000).toISOString();
    await this.persistRetry(release.id, track?.id ?? null, attempt, nextRetryAt, input.error ?? null, input.metadata ?? {});
    await this.persistEvent(release.id, track?.id ?? null, "delivery.retry", "retrying", freeze({ attempt, nextRetryAt }));
    await this.persistHealth(release.id, track?.id ?? null, "retrying", "retrying", freeze({ attempt, nextRetryAt }));
    await this.recordAudit(release.id, "DELIVERY_RETRY_SCHEDULED", "RETRYING", freeze({ attempt, nextRetryAt }), track?.id ?? null);
    recordRetry(queueNames.deliveryRetry);
    QueueDispatcher.enqueueDeliveryRetry({
      type: "RETRY_DELIVERY",
      releaseId: release.id,
      trackId: track?.id ?? null,
      deliveryAttemptId: input.batchId ?? null,
      attempt,
      error: input.error ? String(input.error) : null,
      release,
      track,
      metadata: input.metadata ?? {},
      actorUserId: release.userId,
      correlationId: `retry:${release.id}`,
      sourceSystem: "distribution",
      idempotencyKey: `delivery:retry:${release.id}:${track?.id ?? "release"}:${attempt}`,
      createdAt: nowIso(this.deps.now),
    });
    return freeze({ releaseId: release.id, trackId: track?.id ?? null, attempt, nextRetryAt });
  }

  async rollbackRelease(input: ReleaseAutomationOrchestrationInput & Readonly<{ rollbackReason?: string | null; packageId?: string | null }>): Promise<Readonly<Record<string, unknown>>> {
    const source = await this.resolveSource(input.releaseId, input.release, input.track, input.trackId ?? null);
    const release = source.release;
    const track = source.track;
    const domainRelease = this.toDomainRelease(release, track);
    const recovery = this.deps.releaseDeliveryEngine?.recover(release.id, input.rollbackReason ?? "Rollback requested") ?? null;
    const currentPackage = recovery?.package ?? null;
    const rollback = this.deps.releaseDeliveryEngine && currentPackage ? await this.deps.releaseDeliveryEngine.createRollbackPackage(domainRelease, currentPackage) : null;
    const rollbackId = `rollback_${release.id}_${Date.now().toString(36)}`;
    await this.deps.sql.query(
      `INSERT INTO public.release_rollback (rollback_id, release_id, track_id, package_id, reason, status, metadata, created_at, updated_at)
       VALUES (:rollbackId, :releaseId::uuid, CASE WHEN :trackId IS NULL OR :trackId = '' THEN NULL ELSE :trackId::uuid END, :packageId, :reason, 'rolled_back', CAST(:metadata AS jsonb), now(), now())`,
      {
        rollbackId,
        releaseId: release.id,
        trackId: track?.id ?? null,
        packageId: input.packageId ?? rollback?.packageId ?? null,
        reason: input.rollbackReason ?? null,
        metadata: JSON.stringify({ batchId: input.batchId ?? null, rollback: true }),
      },
    ).catch(() => undefined);
    await this.persistState(release.id, track?.id ?? null, "rolled_back", freeze({ rollbackId, rollbackReason: input.rollbackReason ?? null }));
    await this.persistVersion(release.id, track?.id ?? null, "rolled_back", freeze({ rollbackId, rollbackReason: input.rollbackReason ?? null, packageId: rollback?.packageId ?? input.packageId ?? null }));
    await this.persistEvent(release.id, track?.id ?? null, "release.rollback", "rolled_back", freeze({ rollbackId, rollbackReason: input.rollbackReason ?? null, packageId: rollback?.packageId ?? input.packageId ?? null }));
    await this.persistHealth(release.id, track?.id ?? null, "rolled_back", "rolled_back", freeze({ rollbackId }));
    await this.recordAudit(release.id, "RELEASE_ROLLED_BACK", "ROLLED_BACK", freeze({ rollbackId, packageId: input.packageId ?? null }), track?.id ?? null);
    QueueDispatcher.enqueueRollback({
      type: "ROLLBACK_RELEASE",
      releaseId: release.id,
      trackId: track?.id ?? null,
      packageId: input.packageId ?? null,
      rollbackReason: input.rollbackReason ?? null,
      release,
      track,
      metadata: input.metadata ?? {},
      actorUserId: release.userId,
      correlationId: `rollback:${release.id}`,
      sourceSystem: "distribution",
      idempotencyKey: `release:rollback:${release.id}:${track?.id ?? "release"}:${input.packageId ?? "package"}`,
      createdAt: nowIso(this.deps.now),
    });
    return freeze({ releaseId: release.id, trackId: track?.id ?? null, rollbackId, rollbackPackageId: rollback?.packageId ?? input.packageId ?? null });
  }

  async restoreRelease(input: ReleaseAutomationOrchestrationInput & Readonly<{ checkpointId?: string | null }>): Promise<Readonly<Record<string, unknown>>> {
    const source = await this.resolveSource(input.releaseId, input.release, input.track, input.trackId ?? null);
    const release = source.release;
    const track = source.track;
    await this.persistState(release.id, track?.id ?? null, "restored", freeze({ checkpointId: input.batchId ?? null }));
    await this.persistVersion(release.id, track?.id ?? null, "restored", freeze({ checkpointId: input.batchId ?? null }));
    await this.persistEvent(release.id, track?.id ?? null, "release.restore", "restored", freeze({ checkpointId: input.batchId ?? null }));
    await this.persistHealth(release.id, track?.id ?? null, "restored", "restored", freeze({ checkpointId: input.batchId ?? null }));
    await this.recordAudit(release.id, "RELEASE_RESTORED", "RESTORED", freeze({ checkpointId: input.batchId ?? null }), track?.id ?? null);
    return freeze({ releaseId: release.id, trackId: track?.id ?? null, restored: true, checkpointId: input.batchId ?? null });
  }

  async cancelRelease(input: ReleaseAutomationOrchestrationInput & Readonly<{ reason?: string | null }>): Promise<Readonly<Record<string, unknown>>> {
    const source = await this.resolveSource(input.releaseId, input.release, input.track, input.trackId ?? null);
    await this.persistState(source.release.id, source.track?.id ?? null, "cancelled", freeze({ reason: input.reason ?? null }));
    await this.persistVersion(source.release.id, source.track?.id ?? null, "cancelled", freeze({ reason: input.reason ?? null }));
    await this.persistEvent(source.release.id, source.track?.id ?? null, "release.cancelled", "cancelled", freeze({ reason: input.reason ?? null }));
    await this.persistHealth(source.release.id, source.track?.id ?? null, "cancelled", "cancelled", freeze({ reason: input.reason ?? null }));
    await this.recordAudit(source.release.id, "RELEASE_CANCELLED", "CANCELLED", freeze({ reason: input.reason ?? null }), source.track?.id ?? null);
    return freeze({ releaseId: source.release.id, trackId: source.track?.id ?? null, cancelled: true, reason: input.reason ?? null });
  }

  async processWebhook(input: Readonly<{ releaseId: string; trackId?: string | null; source?: string | null; payload?: Readonly<Record<string, unknown>>; metadata?: Readonly<Record<string, unknown>> }>): Promise<Readonly<Record<string, unknown>>> {
    const batchId = asString(input.payload?.batchId) ?? null;
    await this.deps.sql.query(
      `INSERT INTO public.delivery_confirmations (confirmation_id, release_id, track_id, source, payload, metadata, created_at)
       VALUES (:confirmationId, :releaseId::uuid, CASE WHEN :trackId IS NULL OR :trackId = '' THEN NULL ELSE :trackId::uuid END, :source, CAST(:payload AS jsonb), CAST(:metadata AS jsonb), now())`,
      {
        confirmationId: randomUUID(),
        releaseId: input.releaseId,
        trackId: input.trackId ?? null,
        source: input.source ?? "webhook",
        payload: JSON.stringify(input.payload ?? {}),
        metadata: JSON.stringify(input.metadata ?? {}),
      },
    ).catch(() => undefined);
    await this.persistEvent(input.releaseId, input.trackId ?? null, "release.webhook", "confirmed", freeze({ batchId, source: input.source ?? "webhook" }));
    await this.persistHealth(input.releaseId, input.trackId ?? null, "confirmed", "confirmed", freeze({ batchId, source: input.source ?? "webhook" }));
    await this.recordAudit(input.releaseId, "WEBHOOK_PROCESSED", "CONFIRMED", freeze({ batchId, source: input.source ?? "webhook" }), input.trackId ?? null);
    return freeze({ releaseId: input.releaseId, trackId: input.trackId ?? null, confirmed: true, source: input.source ?? "webhook", batchId });
  }

  async healthCheck(): Promise<Readonly<Record<string, unknown>>> {
    const rows = await this.deps.sql.query<{ workflows: number; health: number; sla: number }>(
      `SELECT
         (SELECT COUNT(*)::int FROM public.release_workflows) AS workflows,
         (SELECT COUNT(*)::int FROM public.delivery_health) AS health,
         (SELECT COUNT(*)::int FROM public.delivery_sla) AS sla`,
    ).catch(() => [{ workflows: 0, health: 0, sla: 0 }]);
    setWorkerHealth(queueNames.deliveryHealth, "healthy");
    return freeze({ healthy: true, workflows: rows[0]?.workflows ?? 0, deliveryHealth: rows[0]?.health ?? 0, deliverySla: rows[0]?.sla ?? 0, generatedAt: nowIso(this.deps.now) });
  }

  async generateReleaseCalendarReport(limit = 50): Promise<ReleaseAutomationReport> {
    const items = await this.deps.sql.query<Readonly<Record<string, unknown>>>(
      `SELECT calendar_id, release_id, track_id, scheduled_for::text AS scheduled_for, timezone, embargo_until::text AS embargo_until, state, created_at::text AS created_at, metadata
       FROM public.release_calendar ORDER BY scheduled_for ASC LIMIT :limit`,
      { limit: Math.max(1, Math.trunc(limit)) },
    ).catch(() => []);
    return freeze({ generatedAt: nowIso(this.deps.now), name: "release-calendar-report", items, summary: { count: items.length } });
  }

  async generateDeliveryReport(limit = 50): Promise<ReleaseAutomationReport> {
    const items = await this.deps.sql.query<Readonly<Record<string, unknown>>>(`SELECT * FROM public.delivery_batches ORDER BY created_at DESC LIMIT :limit`, { limit: Math.max(1, Math.trunc(limit)) }).catch(() => []);
    return freeze({ generatedAt: nowIso(this.deps.now), name: "delivery-report", items, summary: { count: items.length } });
  }

  async generateDeliveryFailureReport(limit = 50): Promise<ReleaseAutomationReport> {
    const items = await this.deps.sql.query<Readonly<Record<string, unknown>>>(`SELECT * FROM public.delivery_attempts WHERE status IN ('FAILED','REJECTED') ORDER BY created_at DESC LIMIT :limit`, { limit: Math.max(1, Math.trunc(limit)) }).catch(() => []);
    return freeze({ generatedAt: nowIso(this.deps.now), name: "delivery-failure-report", items, summary: { count: items.length } });
  }

  async generateRetryReport(limit = 50): Promise<ReleaseAutomationReport> {
    const items = await this.deps.sql.query<Readonly<Record<string, unknown>>>(`SELECT * FROM public.delivery_attempts WHERE attempt_number > 1 OR next_retry_at IS NOT NULL ORDER BY created_at DESC LIMIT :limit`, { limit: Math.max(1, Math.trunc(limit)) }).catch(() => []);
    return freeze({ generatedAt: nowIso(this.deps.now), name: "retry-report", items, summary: { count: items.length } });
  }

  async generateSlaReport(limit = 50): Promise<ReleaseAutomationReport> {
    const items = await this.deps.sql.query<Readonly<Record<string, unknown>>>(`SELECT * FROM public.delivery_sla ORDER BY created_at DESC LIMIT :limit`, { limit: Math.max(1, Math.trunc(limit)) }).catch(() => []);
    return freeze({ generatedAt: nowIso(this.deps.now), name: "sla-report", items, summary: { count: items.length } });
  }

  async generateReleaseAutomationReport(limit = 50): Promise<ReleaseAutomationReport> {
    const items = await this.deps.sql.query<Readonly<Record<string, unknown>>>(`SELECT * FROM public.release_workflows ORDER BY updated_at DESC LIMIT :limit`, { limit: Math.max(1, Math.trunc(limit)) }).catch(() => []);
    return freeze({ generatedAt: nowIso(this.deps.now), name: "release-automation-report", items, summary: { count: items.length } });
  }

  async generateWorkflowReport(limit = 50): Promise<ReleaseAutomationReport> {
    const items = await this.deps.sql.query<Readonly<Record<string, unknown>>>(`SELECT * FROM public.release_states ORDER BY created_at DESC LIMIT :limit`, { limit: Math.max(1, Math.trunc(limit)) }).catch(() => []);
    return freeze({ generatedAt: nowIso(this.deps.now), name: "workflow-report", items, summary: { count: items.length } });
  }

  async generateDeliveryHealthReport(limit = 50): Promise<ReleaseAutomationReport> {
    const items = await this.deps.sql.query<Readonly<Record<string, unknown>>>(`SELECT * FROM public.delivery_health ORDER BY created_at DESC LIMIT :limit`, { limit: Math.max(1, Math.trunc(limit)) }).catch(() => []);
    return freeze({ generatedAt: nowIso(this.deps.now), name: "delivery-health-report", items, summary: { count: items.length } });
  }

  async generateDashboard(kind: "calendar" | "delivery" | "workflow" | "automation" | "retry" | "sla" | "health" = "workflow", limit = 50): Promise<ReleaseAutomationReport> {
    switch (kind) {
      case "calendar":
        return this.generateReleaseCalendarReport(limit);
      case "delivery":
        return this.generateDeliveryReport(limit);
      case "automation":
        return this.generateReleaseAutomationReport(limit);
      case "retry":
        return this.generateRetryReport(limit);
      case "sla":
        return this.generateSlaReport(limit);
      case "health":
        return this.generateDeliveryHealthReport(limit);
      default:
        return this.generateWorkflowReport(limit);
    }
  }

  private async resolveSource(releaseId: string, release: DistributionRelease | null | undefined, track: DistributionTrack | null | undefined, trackId: string | null): Promise<{ release: DistributionRelease; track: DistributionTrack | null }> {
    if (release) {
      return freeze({ release, track: track ?? null });
    }
    const bundle = await this.deps.distributionStore.getReleaseWithTracks(releaseId);
    if (!bundle) throw new Error(`Release not found: ${releaseId}`);
    const resolvedTrack = trackId ? bundle.tracks.find((entry) => entry.id === trackId) ?? null : null;
    return freeze({ release: bundle.release, track: resolvedTrack });
  }

  private inferTargets(release: DistributionRelease, track: DistributionTrack | null): readonly string[] {
    const candidates = [release.metadata?.targetPlatforms, release.metadata?.deliveryTargets, track?.metadata?.targetPlatforms];
    for (const candidate of candidates) {
      if (Array.isArray(candidate) && candidate.length) {
        return candidate.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0);
      }
    }
    return DEFAULT_TARGETS;
  }

  private async releaseReadiness(release: DistributionRelease, track: DistributionTrack | null): Promise<number> {
    const validation = this.deps.releaseDeliveryEngine?.validateRelease ? this.deps.releaseDeliveryEngine.validateRelease(this.toDomainRelease(release, track)) : null;
    const metadata = this.deps.metadataIntelligenceEngine ? await this.deps.metadataIntelligenceEngine.generateReleaseReadiness({ releaseId: release.id, trackId: track?.id ?? null, release, track }) : null;
    const validationScore = validation ? Math.max(0, 100 - validation.errors.length * 15 - validation.warnings.length * 4) : 75;
    const metadataScore = metadata ? metadata.score : 75;
    return Math.max(0, Math.min(100, Math.round((validationScore + metadataScore) / 2)));
  }

  private toDomainRelease(release: DistributionRelease, track: DistributionTrack | null): Release {
    const contributor = new Contributor({ name: release.primaryArtist ?? track?.primaryArtist ?? "Unknown Artist", roles: ["primary_artist"], isPrimary: true });
    return new Release({
      id: new ReleaseId(release.id),
      title: release.title ?? track?.title ?? "Untitled",
      primaryArtist: release.primaryArtist ?? track?.primaryArtist ?? "Unknown Artist",
      version: release.version ? new ReleaseVersion(release.version) : null,
      state: "APPROVED",
      contributors: [contributor],
      tracks: [new Track({
        id: track?.id ?? `${release.id}:track`,
        title: track?.title ?? release.title ?? "Untitled",
        version: track?.version ? new ReleaseVersion(track.version) : null,
        discNumber: 1,
        trackNumber: 1,
        contributors: [contributor],
        territories: new TerritorySet(["WORLD"]),
        isrc: track?.isrc ?? null,
        audioReference: track?.audioUrl ?? null,
        artworkReference: release.coverArtUrl ?? null,
        explicit: Boolean(track?.explicit ?? false),
        lyrics: track?.lyrics ?? null,
        metadata: { ...(release.metadata ?? {}), ...(track?.metadata ?? {}) },
      })],
      label: release.labelName ?? null,
      upc: release.upc ?? null,
      releaseDate: release.releaseDate ?? null,
      originalReleaseDate: release.originalReleaseDate ?? null,
      territories: new TerritorySet(["WORLD"]),
      distributionVersion: new DistributionVersion("1.0"),
      metadata: { ...(release.metadata ?? {}), ...(track?.metadata ?? {}) },
    });
  }

  private async persistWorkflow(input: Readonly<{ releaseId: string; trackId: string | null; state: ReleaseWorkflowState; scheduledFor: string | null; priority: number; embargoUntil: string | null; batchId: string | null; metadata: Readonly<Record<string, unknown>> }>): Promise<void> {
    await this.deps.sql.query(
      `INSERT INTO public.release_workflows (workflow_id, release_id, track_id, state, priority, scheduled_for, embargo_until, batch_id, metadata, created_at, updated_at)
       VALUES (:workflowId, :releaseId::uuid, CASE WHEN :trackId IS NULL OR :trackId = '' THEN NULL ELSE :trackId::uuid END, :state, :priority, :scheduledFor, :embargoUntil, :batchId, CAST(:metadata AS jsonb), now(), now())`,
      { workflowId: randomUUID(), ...input, metadata: JSON.stringify(input.metadata) },
    ).catch(() => undefined);
    await this.persistState(input.releaseId, input.trackId, input.state, input.metadata);
    await this.deps.sql.query(
      `INSERT INTO public.delivery_schedule (schedule_id, release_id, track_id, state, scheduled_for, timezone, embargo_until, priority, metadata, created_at, updated_at)
       VALUES (:scheduleId, :releaseId::uuid, CASE WHEN :trackId IS NULL OR :trackId = '' THEN NULL ELSE :trackId::uuid END, :state, :scheduledFor, NULL, :embargoUntil, :priority, CAST(:metadata AS jsonb), now(), now())`,
      { scheduleId: randomUUID(), ...input, metadata: JSON.stringify(input.metadata) },
    ).catch(() => undefined);
    await this.deps.sql.query(
      `INSERT INTO public.release_calendar (calendar_id, release_id, track_id, scheduled_for, timezone, embargo_until, state, metadata, created_at, updated_at)
       VALUES (:calendarId, :releaseId::uuid, CASE WHEN :trackId IS NULL OR :trackId = '' THEN NULL ELSE :trackId::uuid END, :scheduledFor, NULL, :embargoUntil, :state, CAST(:metadata AS jsonb), now(), now())`,
      { calendarId: randomUUID(), ...input, metadata: JSON.stringify(input.metadata) },
    ).catch(() => undefined);
  }

  private async persistVersion(releaseId: string, trackId: string | null, state: ReleaseWorkflowState, metadata: Readonly<Record<string, unknown>>): Promise<void> {
    await this.deps.sql.query(
      `INSERT INTO public.release_versions (version_id, release_id, track_id, state, metadata, created_at, updated_at)
       VALUES (:versionId, :releaseId::uuid, CASE WHEN :trackId IS NULL OR :trackId = '' THEN NULL ELSE :trackId::uuid END, :state, CAST(:metadata AS jsonb), now(), now())`,
      { versionId: randomUUID(), releaseId, trackId, state, metadata: JSON.stringify(metadata) },
    ).catch(() => undefined);
  }

  private async persistDependencies(batchId: string, releaseId: string, trackId: string | null, dependencyReleaseIds: readonly string[]): Promise<void> {
    if (!dependencyReleaseIds.length) return;
    for (const dependencyReleaseId of dependencyReleaseIds) {
      await this.deps.sql.query(
        `INSERT INTO public.delivery_dependencies (dependency_id, batch_id, release_id, track_id, dependency_release_id, dependency_state, metadata, created_at, updated_at)
         VALUES (:dependencyId, :batchId, :releaseId::uuid, CASE WHEN :trackId IS NULL OR :trackId = '' THEN NULL ELSE :trackId::uuid END, :dependencyReleaseId::uuid, 'pending', '{}'::jsonb, now(), now())`,
        { dependencyId: randomUUID(), batchId, releaseId, trackId, dependencyReleaseId },
      ).catch(() => undefined);
    }
  }

  private async persistState(releaseId: string, trackId: string | null, state: ReleaseWorkflowState, metadata: Readonly<Record<string, unknown>>): Promise<void> {
    await this.deps.sql.query(
      `INSERT INTO public.release_states (state_id, release_id, track_id, state, metadata, created_at, updated_at)
       VALUES (:stateId, :releaseId::uuid, CASE WHEN :trackId IS NULL OR :trackId = '' THEN NULL ELSE :trackId::uuid END, :state, CAST(:metadata AS jsonb), now(), now())`,
      { stateId: randomUUID(), releaseId, trackId, state, metadata: JSON.stringify(metadata) },
    ).catch(() => undefined);
  }

  private async persistLock(releaseId: string, trackId: string | null, lockKind: string, metadata: Readonly<Record<string, unknown>>): Promise<void> {
    await this.deps.sql.query(
      `INSERT INTO public.release_locks (lock_id, release_id, track_id, lock_kind, status, metadata, created_at, updated_at)
       VALUES (:lockId, :releaseId::uuid, CASE WHEN :trackId IS NULL OR :trackId = '' THEN NULL ELSE :trackId::uuid END, :lockKind, 'locked', CAST(:metadata AS jsonb), now(), now())`,
      { lockId: randomUUID(), releaseId, trackId, lockKind, metadata: JSON.stringify(metadata) },
    ).catch(() => undefined);
  }

  private async persistBatch(batchId: string, releaseId: string, trackId: string | null, targets: readonly string[], readiness: number, metadata: Readonly<Record<string, unknown>>): Promise<void> {
    await this.deps.sql.query(
      `INSERT INTO public.delivery_batches (batch_id, release_id, track_id, target_count, priority, readiness_score, status, metadata, created_at, updated_at)
       VALUES (:batchId, :releaseId::uuid, CASE WHEN :trackId IS NULL OR :trackId = '' THEN NULL ELSE :trackId::uuid END, :targetCount, :priority, :readinessScore, :status, CAST(:metadata AS jsonb), now(), now())`,
      {
        batchId,
        releaseId,
        trackId,
        targetCount: targets.length,
        priority: 50,
        readinessScore: readiness,
        status: readiness >= 80 ? "ready" : readiness >= 60 ? "scheduled" : "pending",
        metadata: JSON.stringify({ ...metadata, targets }),
      },
    ).catch(() => undefined);
  }

  private async persistEvent(releaseId: string, trackId: string | null, eventType: string, status: string, metadata: Readonly<Record<string, unknown>>): Promise<void> {
    await this.deps.sql.query(
      `INSERT INTO public.delivery_events (event_id, release_id, track_id, event_type, status, metadata, created_at)
       VALUES (:eventId, :releaseId::uuid, CASE WHEN :trackId IS NULL OR :trackId = '' THEN NULL ELSE :trackId::uuid END, :eventType, :status, CAST(:metadata AS jsonb), now())`,
      { eventId: randomUUID(), releaseId, trackId, eventType, status, metadata: JSON.stringify(metadata) },
    ).catch(() => undefined);
  }

  private async persistHealth(releaseId: string, trackId: string | null, state: string, status: string, metadata: Readonly<Record<string, unknown>>): Promise<void> {
    await this.deps.sql.query(
      `INSERT INTO public.delivery_health (health_id, release_id, track_id, state, status, score, metadata, created_at, updated_at)
       VALUES (:healthId, :releaseId::uuid, CASE WHEN :trackId IS NULL OR :trackId = '' THEN NULL ELSE :trackId::uuid END, :state, :status, 100, CAST(:metadata AS jsonb), now(), now())`,
      { healthId: randomUUID(), releaseId, trackId, state, status, metadata: JSON.stringify(metadata) },
    ).catch(() => undefined);
  }

  private async persistSla(releaseId: string, trackId: string | null, slaKind: string, score: number, metadata: Readonly<Record<string, unknown>>): Promise<void> {
    await this.deps.sql.query(
      `INSERT INTO public.delivery_sla (sla_id, release_id, track_id, sla_kind, score, status, metadata, created_at, updated_at)
       VALUES (:slaId, :releaseId::uuid, CASE WHEN :trackId IS NULL OR :trackId = '' THEN NULL ELSE :trackId::uuid END, :slaKind, :score, 'met', CAST(:metadata AS jsonb), now(), now())`,
      { slaId: randomUUID(), releaseId, trackId, slaKind, score, metadata: JSON.stringify(metadata) },
    ).catch(() => undefined);
  }

  private async persistAttempt(batchId: string, releaseId: string, trackId: string | null, target: string, attempt: number, status: string, error: unknown, metadata: Readonly<Record<string, unknown>>): Promise<void> {
    await this.deps.sql.query(
      `INSERT INTO public.delivery_attempts (attempt_id, batch_id, release_id, track_id, target, attempt_number, status, error, metadata, created_at)
       VALUES (:attemptId, :batchId, :releaseId::uuid, CASE WHEN :trackId IS NULL OR :trackId = '' THEN NULL ELSE :trackId::uuid END, :target, :attemptNumber, :status, :error, CAST(:metadata AS jsonb), now())`,
      {
        attemptId: randomUUID(),
        batchId,
        releaseId,
        trackId,
        target,
        attemptNumber: attempt,
        status,
        error: error instanceof Error ? error.message : error ? String(error) : null,
        metadata: JSON.stringify(metadata),
      },
    ).catch(() => undefined);
  }

  private async persistRetry(releaseId: string, trackId: string | null, attempt: number, nextRetryAt: string, error: unknown, metadata: Readonly<Record<string, unknown>>): Promise<void> {
    await this.deps.sql.query(
      `INSERT INTO public.delivery_attempts (attempt_id, batch_id, release_id, track_id, target, attempt_number, status, next_retry_at, last_error, metadata, created_at)
       VALUES (:attemptId, :batchId, :releaseId::uuid, CASE WHEN :trackId IS NULL OR :trackId = '' THEN NULL ELSE :trackId::uuid END, :target, :attemptNumber, :status, :nextRetryAt, :lastError, CAST(:metadata AS jsonb), now())`,
      {
        attemptId: randomUUID(),
        batchId: null,
        releaseId,
        trackId,
        target: "delivery",
        attemptNumber: attempt,
        status: "retry_scheduled",
        nextRetryAt,
        lastError: error instanceof Error ? error.message : error ? String(error) : null,
        metadata: JSON.stringify(metadata),
      },
    ).catch(() => undefined);
  }

  private async recordAudit(releaseId: string, action: string, status: string, metadata: Readonly<Record<string, unknown>>, trackId: string | null): Promise<void> {
    await this.deps.sql.query(
      `INSERT INTO public.delivery_audit (audit_id, release_id, track_id, action, status, actor, metadata, created_at)
       VALUES (:auditId, :releaseId::uuid, CASE WHEN :trackId IS NULL OR :trackId = '' THEN NULL ELSE :trackId::uuid END, :action, :status, :actor, CAST(:metadata AS jsonb), now())`,
      {
        auditId: randomUUID(),
        releaseId,
        trackId,
        action,
        status,
        actor: "system",
        metadata: JSON.stringify(metadata),
      },
    ).catch(() => undefined);
    await this.deps.enterpriseOperationsService.recordAuditEvent({
      aggregateType: "release_workflow",
      aggregateId: releaseId,
      action,
      actor: "system",
      reason: null,
      correlationId: null,
      oldValue: null,
      newValue: metadata,
      metadata: freeze({ ...metadata, status }),
      ipAddress: null,
    }).catch(() => undefined);
    incrementMetric("tracksyra_release_workflow_events_total", { action, status });
  }
}
