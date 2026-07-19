import { DistributionState, DistributionStateMachine } from "../domain";
import { DistributionStatus } from "../intelligence/distributionStatus";
import { AuditRecord } from "../intelligence/audit/auditRecord";
import { DashboardProjection as IntelligenceDashboardProjection } from "../intelligence/dashboard/dashboardProjection";
import { DistributionProjection } from "../intelligence/projection/distributionProjection";
import { ReleaseProjection as IntelligenceReleaseProjection } from "../intelligence/projection/releaseProjection";
import { TimelineEntry } from "../intelligence/timeline/timelineEntry";
import { AnalyticsSnapshot } from "../intelligence/snapshots/analyticsSnapshot";
import { ProjectionCheckpoint } from "../intelligence/snapshots/projectionCheckpoint";
import { ReconciliationResult } from "./reconciliation/reconciliationResult";
import { StatusSnapshot } from "./snapshot/statusSnapshot";
import { StatusTimeline } from "./timeline/statusTimeline";
import { NormalizedStatus, type StatusNormalizer } from "./normalization/normalizedStatus";
import { ProviderStatusEvent } from "./events/providerStatusEvent";
import { WebhookEvent } from "./webhooks/webhookEvent";
import { PollingResult } from "./polling/pollingResult";
import { StatusTransition } from "./types/statusTypes";
import { TransitionValidationResult, type TransitionValidator } from "./validation/transitionValidation";
import { ConflictResolution, type ConflictResolver } from "./conflict/conflictResolution";
import { serializeCanonicalJSON } from "../core/canonicalSerializer";
import { TrackSyraStatusMapper, TrackSyraStatusMetrics, TrackSyraStatusLogger, TrackSyraStatusSyncRuntimeEngine, type StatusSyncRuntimeDependencies } from "./runtime/statusSyncRuntime";
import type { StatusLogger } from "./logging/statusLogger";
import type { StatusMetrics } from "./metrics/statusMetrics";
import type { StatusMapper } from "./mapping/statusMapper";
import type { RuntimeRepository } from "../infrastructure/repositories/runtime";

export type StatusSyncRepositoryBundle = Readonly<{
  values: RuntimeRepository<string, TrackSyraStatusSyncRuntimeEngine>;
  snapshots: RuntimeRepository<string, StatusSnapshot>;
  history: RuntimeRepository<string, readonly StatusTransition[]>;
  versions: RuntimeRepository<string, number>;
  published: RuntimeRepository<string, StatusTimeline>;
  distribution: RuntimeRepository<string, DistributionProjection>;
  release: RuntimeRepository<string, IntelligenceReleaseProjection>;
  dashboard: RuntimeRepository<string, IntelligenceDashboardProjection>;
  analytics: RuntimeRepository<string, AnalyticsSnapshot>;
  checkpoints: RuntimeRepository<string, ProjectionCheckpoint>;
}>;

type ProjectionKind = "distribution" | "release" | "dashboard";

function isoNow(): string {
  return new Date().toISOString();
}

function freezeRecord<T extends Readonly<Record<string, unknown>>>(value: T): T {
  return Object.freeze({ ...value }) as T;
}

function ensure(value: string, field: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`${field} must not be empty`);
  }
  return trimmed;
}

function mapStateToDistributionStatus(state: DistributionState): DistributionStatus {
  switch (state) {
    case "DSP_LIVE":
    case "CATALOG_ACTIVE":
    case "ROYALTY_READY":
    case "ROYALTY_IMPORTED":
    case "PAYMENT_PROCESSING":
    case "STATEMENT_GENERATED":
    case "RELEASE_ARCHIVED":
      return DistributionStatus.PUBLISHED;
    case "DSP_ACCEPTED":
    case "PROVIDER_PROCESSING":
    case "SUBMITTED_TO_PROVIDER":
    case "UPLOAD_IN_PROGRESS":
    case "AUTHENTICATING_PROVIDER":
      return DistributionStatus.PROCESSING;
    case "APPROVED":
      return DistributionStatus.APPROVED;
    case "VALIDATED":
    case "APPROVAL_PENDING":
    case "PACKAGE_BUILT":
    case "PACKAGE_VERIFIED":
    case "DISTRIBUTION_JOB_CREATED":
    case "PROVIDER_SELECTED":
      return DistributionStatus.IN_REVIEW;
    case "REJECTED":
      return DistributionStatus.REJECTED;
    case "CANCELLED":
    case "TAKEDOWN_PENDING":
    case "TAKEDOWN_COMPLETED":
      return DistributionStatus.REJECTED;
    case "SUBMISSION_LOCKED":
    case "SNAPSHOT_CREATED":
    case "VALIDATION_PENDING":
    case "METADATA_GENERATED":
    case "DRAFT":
    default:
      return DistributionStatus.PENDING;
  }
}

export class StateRegistry {
  constructor(private readonly values: StatusSyncRepositoryBundle["values"]) {}

  register(key: string, runtime: TrackSyraStatusSyncRuntimeEngine): void {
    this.values.set(ensure(key, "key"), runtime);
  }

  resolve(key: string): TrackSyraStatusSyncRuntimeEngine | null {
    return this.values.get(ensure(key, "key")) ?? this.values.get("*") ?? null;
  }

  list(): readonly string[] {
    return Object.freeze([...this.values.keys()]);
  }
}

export class StateSnapshotManager {
  constructor(private readonly snapshots: StatusSyncRepositoryBundle["snapshots"]) {}

  store(snapshot: StatusSnapshot): void {
    this.snapshots.set(snapshot.releaseId, snapshot);
  }

  resolve(releaseId: string): StatusSnapshot | null {
    return this.snapshots.get(ensure(releaseId, "releaseId")) ?? null;
  }

  list(): readonly StatusSnapshot[] {
    return Object.freeze([...this.snapshots.values()]);
  }
}

export class StateHistoryManager {
  constructor(private readonly history: StatusSyncRepositoryBundle["history"]) {}

  append(releaseId: string, transition: StatusTransition): void {
    const key = ensure(releaseId, "releaseId");
    const current = this.history.get(key) ?? [];
    this.history.set(key, Object.freeze([...current, transition]));
  }

  resolve(releaseId: string): readonly StatusTransition[] {
    return this.history.get(ensure(releaseId, "releaseId")) ?? [];
  }
}

export class StateVersionManager {
  constructor(private readonly versions: StatusSyncRepositoryBundle["versions"]) {}

  next(releaseId: string): number {
    const key = ensure(releaseId, "releaseId");
    const current = this.versions.get(key) ?? 0;
    const next = current + 1;
    this.versions.set(key, next);
    return next;
  }

  current(releaseId: string): number {
    return this.versions.get(ensure(releaseId, "releaseId")) ?? 1;
  }
}

export class StatusEvidenceCollector {
  collect(input: WebhookEvent | PollingResult | ProviderStatusEvent): readonly import("./types/statusTypes").StatusEvidence[] {
    if (input instanceof WebhookEvent) {
      return [input.providerStatusEvent.toEvidence()];
    }
    if (input instanceof PollingResult) {
      return input.snapshot.evidence;
    }
    return [input.toEvidence()];
  }
}

export class MergeStrategy {
  merge(current: NormalizedStatus, incoming: NormalizedStatus): NormalizedStatus {
    if (incoming.normalizedAt >= current.normalizedAt) {
      return incoming;
    }
    return current;
  }
}

export class ConsensusResolver {
  constructor(private readonly mergeStrategy: MergeStrategy) {}

  resolve(current: NormalizedStatus, candidates: readonly NormalizedStatus[]): NormalizedStatus {
    return candidates.reduce((best, candidate) => this.mergeStrategy.merge(best, candidate), current);
  }
}

export class StateReconciliationEngine {
  constructor(
    private readonly validator: TransitionValidator,
    private readonly conflictResolver: ConflictResolver,
    private readonly consensusResolver: ConsensusResolver,
  ) {}

  reconcile(snapshot: StatusSnapshot, evidences: readonly NormalizedStatus[]): ReconciliationResult {
    const normalized = this.consensusResolver.resolve(snapshot.current, evidences.length ? evidences : [snapshot.current]);
    const validation = this.validator.validate(snapshot.currentState, normalized);
    const transition = validation.valid
      ? new StatusTransition({
          releaseId: snapshot.releaseId,
          from: snapshot.currentState,
          to: normalized.canonicalState,
          source: normalized.source,
          reason: normalized.rawStatus,
          metadata: freezeRecord({ providerReference: snapshot.providerReference }),
        })
      : null;
    return new ReconciliationResult({
      releaseId: snapshot.releaseId,
      success: validation.valid,
      snapshot,
      normalizedStatus: normalized,
      transition,
      conflictResolution: validation.valid
        ? null
        : this.conflictResolver.resolve({
            releaseId: snapshot.releaseId,
            conflictType: "WebhookVsPolling",
            reason: validation.reason,
            metadata: freezeRecord({ currentState: snapshot.currentState, nextState: normalized.canonicalState }),
          }),
      warnings: validation.valid ? [] : [validation.reason ?? "transition rejected"],
      errors: validation.valid ? [] : [validation.reason ?? "transition rejected"],
      metadata: freezeRecord({ reconciledBy: "StateReconciliationEngine" }),
    });
  }
}

export class TransitionPlanner {
  constructor(private readonly validator: TransitionValidator) {}

  plan(snapshot: StatusSnapshot, incoming: NormalizedStatus): StatusTransition | null {
    const validation = this.validator.validate(snapshot.currentState, incoming);
    if (!validation.valid) {
      return null;
    }
    return new StatusTransition({
      releaseId: snapshot.releaseId,
      from: snapshot.currentState,
      to: incoming.canonicalState,
      source: incoming.source,
      reason: incoming.rawStatus,
      metadata: freezeRecord({ providerReference: incoming.providerReference }),
    });
  }
}

export class SnapshotVersioning {
  next(current: StatusSnapshot | null): number {
    return current ? current.version + 1 : 1;
  }
}

export class SnapshotSerializer {
  serialize(snapshot: StatusSnapshot): string {
    return serializeCanonicalJSON(snapshot);
  }

  deserialize(serialized: string): StatusSnapshot {
    const value = JSON.parse(serialized) as StatusSnapshot;
    return value;
  }
}

export class SnapshotStore {
  constructor(private readonly snapshots: StatusSyncRepositoryBundle["snapshots"]) {}

  save(snapshot: StatusSnapshot): void {
    this.snapshots.set(snapshot.releaseId, snapshot);
  }

  load(releaseId: string): StatusSnapshot | null {
    return this.snapshots.get(ensure(releaseId, "releaseId")) ?? null;
  }
}

export class SnapshotGenerator {
  constructor(private readonly versioning: SnapshotVersioning) {}

  generate(input: {
    releaseId: string;
    providerReference?: string | null;
    current: NormalizedStatus;
    previous?: NormalizedStatus | null;
    evidence?: readonly import("./types/statusTypes").StatusEvidence[];
    metadata?: Readonly<Record<string, unknown>>;
  }): StatusSnapshot {
    return new StatusSnapshot({
      releaseId: input.releaseId,
      providerReference: input.providerReference ?? input.current.providerReference,
      current: input.current,
      previous: input.previous ?? null,
      version: this.versioning.next(null),
      evidence: input.evidence,
      metadata: freezeRecord(input.metadata ?? {}),
    });
  }
}

export class SnapshotRecovery {
  constructor(private readonly store: SnapshotStore, private readonly serializer: SnapshotSerializer) {}

  recover(releaseId: string): StatusSnapshot | null {
    const snapshot = this.store.load(releaseId);
    return snapshot ? this.serializer.deserialize(this.serializer.serialize(snapshot)) : null;
  }
}

export class StateSnapshotManagerBridge {
  constructor(private readonly store: SnapshotStore, private readonly generator: SnapshotGenerator) {}

  capture(input: {
    releaseId: string;
    providerReference?: string | null;
    current: NormalizedStatus;
    previous?: NormalizedStatus | null;
    evidence?: readonly import("./types/statusTypes").StatusEvidence[];
    metadata?: Readonly<Record<string, unknown>>;
  }): StatusSnapshot {
    const snapshot = this.generator.generate(input);
    this.store.save(snapshot);
    return snapshot;
  }
}

export class TimelineBuilder {
  build(events: readonly StatusTransition[]): StatusTimeline {
    return new StatusTimeline({
      releaseId: events[0]?.releaseId ?? "unknown",
      events,
      metadata: freezeRecord({ eventCount: events.length }),
    });
  }
}

export class TimelinePublisher {
  constructor(private readonly published: StatusSyncRepositoryBundle["published"]) {}

  publish(timeline: StatusTimeline): void {
    this.published.set(timeline.releaseId, timeline);
  }

  resolve(releaseId: string): StatusTimeline | null {
    return this.published.get(ensure(releaseId, "releaseId")) ?? null;
  }
}

export class TimelineProjector {
  build(timeline: StatusTimeline): readonly TimelineEntry[] {
    return timeline.events.map((event, index) => new TimelineEntry({
      releaseId: event.releaseId,
      stage: "DSP Processing",
      label: `${event.from ?? "UNKNOWN"} -> ${event.to}`,
      occurredAt: event.appliedAt ?? event.requestedAt,
      metadata: freezeRecord({ index, source: event.source, reason: event.reason }),
    }));
  }
}

export class AuditTimeline {
  private readonly records: AuditRecord[] = [];

  record(timeline: StatusTimeline): readonly AuditRecord[] {
    for (const event of timeline.events) {
      this.records.push(new AuditRecord({
        recordId: `${timeline.releaseId}:${event.requestedAt}`,
        releaseId: timeline.releaseId,
        eventType: "StatusTransition",
        recordedAt: event.requestedAt,
        payload: freezeRecord({ from: event.from, to: event.to, source: event.source, reason: event.reason }),
        metadata: freezeRecord({ timelineReleaseId: timeline.releaseId }),
      }));
    }
    return Object.freeze([...this.records]);
  }
}

export class ReplayEngine {
  constructor(
    private readonly planner: TransitionPlanner,
    private readonly mapper: StatusMapper,
  ) {}

  replay(snapshot: StatusSnapshot, events: readonly ProviderStatusEvent[]): StatusSnapshot {
    let current = snapshot;
    for (const event of events) {
      const normalized = this.mapper.map(event);
      const planned = this.planner.plan(current, normalized);
      if (planned) {
        current = new StatusSnapshot({
          releaseId: current.releaseId,
          providerReference: current.providerReference,
          current: normalized,
          previous: current.current,
          version: current.version + 1,
          evidence: [...current.evidence, event.toEvidence()],
          metadata: current.metadata,
        });
      }
    }
    return current;
  }
}

export class EventReplay {
  constructor(private readonly replayEngine: ReplayEngine) {}

  replay(snapshot: StatusSnapshot, events: readonly ProviderStatusEvent[]): StatusSnapshot {
    return this.replayEngine.replay(snapshot, events);
  }
}

export class StateRecovery {
  constructor(private readonly snapshotRecovery: SnapshotRecovery, private readonly replayEngine: ReplayEngine) {}

  recover(releaseId: string, events: readonly ProviderStatusEvent[] = []): StatusSnapshot | null {
    const snapshot = this.snapshotRecovery.recover(releaseId);
    return snapshot ? this.replayEngine.replay(snapshot, events) : null;
  }
}

export class CheckpointRecovery {
  constructor(private readonly store: SnapshotStore) {}

  recover(releaseId: string): StatusSnapshot | null {
    return this.store.load(releaseId);
  }
}

export class RollbackPlanner {
  plan(snapshot: StatusSnapshot): StatusSnapshot {
    const previous = snapshot.previous ?? snapshot.current;
    return new StatusSnapshot({
      releaseId: snapshot.releaseId,
      providerReference: snapshot.providerReference,
      current: previous,
      previous: null,
      version: snapshot.version + 1,
      evidence: snapshot.evidence,
      metadata: snapshot.metadata,
    });
  }
}

export class ProjectionPublisher {
  constructor(
    private readonly distribution: StatusSyncRepositoryBundle["distribution"],
    private readonly release: StatusSyncRepositoryBundle["release"],
    private readonly dashboard: StatusSyncRepositoryBundle["dashboard"],
    private readonly analytics: StatusSyncRepositoryBundle["analytics"],
    private readonly checkpoints: StatusSyncRepositoryBundle["checkpoints"],
  ) {}

  publish(result: ReconciliationResult): void {
    const status = mapStateToDistributionStatus(result.normalizedStatus.canonicalState);
    this.distribution.set(result.releaseId, new DistributionProjection({
      releaseId: result.releaseId,
      state: status,
      updatedAt: result.reconciledAt,
      version: result.snapshot.version,
      metadata: freezeRecord({ source: result.normalizedStatus.source }),
    }));
    this.release.set(result.releaseId, new IntelligenceReleaseProjection({
      releaseId: result.releaseId,
      title: result.releaseId,
      artist: "Track Syra",
      state: status,
      version: result.snapshot.version,
      providerReference: result.snapshot.providerReference,
      updatedAt: result.reconciledAt,
      metadata: freezeRecord({ source: result.normalizedStatus.source }),
    }));
    this.dashboard.set(result.releaseId, new IntelligenceDashboardProjection({
      releaseId: result.releaseId,
      title: result.releaseId,
      artist: "Track Syra",
      state: status,
      providerReference: result.snapshot.providerReference,
      summary: freezeRecord({ source: result.normalizedStatus.source }),
      updatedAt: result.reconciledAt,
      metadata: freezeRecord({ source: result.normalizedStatus.source }),
    }));
    this.analytics.set(result.releaseId, new AnalyticsSnapshot({
      releaseId: result.releaseId,
      generatedAt: result.reconciledAt,
      metrics: {
        submissionCounts: 1,
        approvalRate: result.success ? 100 : 0,
        distributionSuccessRate: result.success ? 100 : 0,
        dspLatency: 0,
        uploadLatency: 0,
        failureRate: result.success ? 0 : 100,
        retryRate: 0,
        royaltyTotals: 0,
        paymentTotals: 0,
      },
      metadata: freezeRecord({ source: result.normalizedStatus.source }),
    }));
    this.checkpoints.set(result.releaseId, new ProjectionCheckpoint({
      checkpointId: `${result.releaseId}:${result.snapshot.version}`,
      releaseId: result.releaseId,
      version: result.snapshot.version,
      createdAt: result.reconciledAt,
      replayCursor: result.transition?.requestedAt ?? null,
      metadata: freezeRecord({ source: result.normalizedStatus.source }),
    }));
  }
}

export class DashboardProjection {
  constructor(private readonly publisher: ProjectionPublisher) {}
  project(result: ReconciliationResult): void {
    this.publisher.publish(result);
  }
}

export class AnalyticsProjection {
  constructor(private readonly publisher: ProjectionPublisher) {}
  project(result: ReconciliationResult): void {
    this.publisher.publish(result);
  }
}

export class ReleaseProjection {
  constructor(private readonly publisher: ProjectionPublisher) {}
  project(result: ReconciliationResult): void {
    this.publisher.publish(result);
  }
}

export class StateCoordinator {
  constructor(private readonly runtime: StateSyncRuntimeEngine) {}

  coordinate(input: {
    webhook?: WebhookEvent | null;
    polling?: PollingResult | null;
    snapshot: StatusSnapshot;
  }): Promise<ReconciliationResult> {
    return this.runtime.synchronize(input);
  }
}

export class StateResolver {
  constructor(private readonly registry: StateRegistry) {}

  resolve(key?: string | null): StateSyncRuntimeEngine | null {
    if (key) {
      return this.registry.resolve(key) ?? this.registry.resolve("*");
    }
    return this.registry.resolve("*");
  }
}

export class StateSyncRuntimeEngine extends TrackSyraStatusSyncRuntimeEngine {
  constructor(dependencies: StatusSyncRuntimeDependencies) {
    super(dependencies);
  }
}

export class IncrementalSync {
  constructor(private readonly coordinator: StateCoordinator) {}

  sync(input: Parameters<StateCoordinator["coordinate"]>[0]): Promise<ReconciliationResult> {
    return this.coordinator.coordinate(input);
  }
}

export class FullSync extends IncrementalSync {}
export class ScheduledSync extends IncrementalSync {}
export class ManualSync extends IncrementalSync {}
export class RetrySync extends IncrementalSync {}
export class BackgroundSync extends IncrementalSync {}

export class StateSyncLogger extends TrackSyraStatusLogger {}
export class StateSyncMetrics extends TrackSyraStatusMetrics {}

export class StateSyncHealthChecker {
  healthy(): boolean {
    return true;
  }
}
