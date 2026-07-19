import type { DistributionOrchestrator } from "../../application/services";
import { DistributionState, DistributionStateMachine, ReleaseId } from "../../domain";
import { DistributionStatusSyncEngineBridge } from "../statusSyncBridge";
import { ConflictResolution, type ConflictResolver } from "../conflict/conflictResolution";
import { NormalizedStatus, type StatusNormalizer } from "../normalization/normalizedStatus";
import { PollingResult, type PollingProcessor } from "../polling/pollingResult";
import { ProjectionUpdater, type ProjectionUpdater as ProjectionUpdaterPort } from "../projection/statusProjection";
import { ReconciliationResult, type ReconciliationEngine } from "../reconciliation/reconciliationResult";
import { StatusScheduler, type StatusScheduler as StatusSchedulerPort } from "../scheduler/statusScheduler";
import { StatusSnapshot } from "../snapshot/statusSnapshot";
import { StatusTimeline, type TimelineUpdater as TimelineUpdaterPort } from "../timeline/statusTimeline";
import { StatusEvidence, StatusEventCategory, StatusSyncSource, StatusTransition } from "../types/statusTypes";
import { TransitionValidationResult, type TransitionValidator } from "../validation/transitionValidation";
import { ProviderStatusEvent, type StatusSyncEventPublisher } from "../events/providerStatusEvent";
import type { WebhookProcessor } from "../webhooks/webhookEvent";
import type { StatusLogger as StatusLoggerPort } from "../logging/statusLogger";
import type { StatusMapper as StatusMapperPort } from "../mapping/statusMapper";
import type { StatusMetrics as StatusMetricsPort } from "../metrics/statusMetrics";
import type { StatusSyncEngine } from "../contracts/statusSyncEngine";
import { WebhookEvent } from "../webhooks/webhookEvent";

type RuntimeTags = Readonly<Record<string, string | number | boolean>>;

type RuntimeWebhookHandler = (event: WebhookEvent) => Promise<ReconciliationResult> | ReconciliationResult;

type RuntimePollingHandler = (input: {
  releaseId: string;
  providerReference?: string | null;
  snapshot: StatusSnapshot;
}) => Promise<PollingResult> | PollingResult;

type RuntimeDeadLetter = Readonly<{
  kind: "webhook" | "polling";
  reason: string;
  releaseId: string;
  createdAt: string;
  eventId: string | null;
  providerReference: string | null;
  metadata: Readonly<Record<string, unknown>>;
}>;

type RuntimeRetry = Readonly<{
  kind: "webhook" | "polling";
  attempts: number;
  nextAttemptAt: string | null;
  payload: WebhookEvent | PollingResult;
  createdAt: string;
  metadata: Readonly<Record<string, unknown>>;
}>;

function isoNow(): string {
  return new Date().toISOString();
}

function freezeRecord<T extends Readonly<Record<string, unknown>>>(value: T): T {
  return Object.freeze({ ...value }) as T;
}

function trim(value: string): string {
  return value.trim();
}

function ensure(value: string, field: string): string {
  const trimmed = trim(value);
  if (!trimmed) {
    throw new Error(`${field} must not be empty`);
  }
  return trimmed;
}

function safeTags(tags: RuntimeTags | undefined): RuntimeTags {
  return Object.freeze({ ...(tags ?? {}) });
}

function createFallbackProviderStatusEvent(snapshot: StatusSnapshot, source: StatusSyncSource): ProviderStatusEvent {
  return new ProviderStatusEvent({
    eventId: `${snapshot.releaseId}:webhook`,
    releaseId: snapshot.releaseId,
    providerReference: snapshot.providerReference ?? "unknown",
    providerStatus: snapshot.currentState,
    source,
  });
}

export class TrackSyraStatusLogger implements StatusLoggerPort {
  private readonly entries: {
    level: "debug" | "info" | "warn" | "error";
    message: string;
    context: Readonly<Record<string, unknown>>;
    recordedAt: string;
  }[] = [];

  private log(level: "debug" | "info" | "warn" | "error", message: string, context?: Readonly<Record<string, unknown>>): void {
    const entry = Object.freeze({
      level,
      message: ensure(message, "message"),
      context: freezeRecord(context ?? {}),
      recordedAt: isoNow(),
    });
    this.entries.push(entry);
  }

  debug(message: string, context?: Readonly<Record<string, unknown>>): void {
    this.log("debug", message, context);
  }

  info(message: string, context?: Readonly<Record<string, unknown>>): void {
    this.log("info", message, context);
  }

  warn(message: string, context?: Readonly<Record<string, unknown>>): void {
    this.log("warn", message, context);
  }

  error(message: string, context?: Readonly<Record<string, unknown>>): void {
    this.log("error", message, context);
  }

  list(): readonly {
    level: "debug" | "info" | "warn" | "error";
    message: string;
    context: Readonly<Record<string, unknown>>;
    recordedAt: string;
  }[] {
    return Object.freeze([...this.entries]);
  }
}

export class TrackSyraStatusMetrics implements StatusMetricsPort {
  private readonly counters = new Map<string, number>();
  private readonly gauges = new Map<string, number>();
  private readonly observations = new Map<string, readonly number[]>();

  increment(metric: string, value = 1, tags: RuntimeTags = {}): void {
    const key = this.key(metric, tags);
    this.counters.set(key, (this.counters.get(key) ?? 0) + value);
  }

  observe(metric: string, value: number, tags: RuntimeTags = {}): void {
    const key = this.key(metric, tags);
    const current = this.observations.get(key) ?? [];
    this.observations.set(key, Object.freeze([...current, value]));
  }

  gauge(metric: string, value: number, tags: RuntimeTags = {}): void {
    const key = this.key(metric, tags);
    this.gauges.set(key, value);
  }

  snapshot(): Readonly<Record<string, unknown>> {
    return freezeRecord({
      counters: Object.freeze(Object.fromEntries(this.counters.entries())),
      gauges: Object.freeze(Object.fromEntries(this.gauges.entries())),
      observations: Object.freeze(Object.fromEntries(this.observations.entries())),
    });
  }

  private key(metric: string, tags: RuntimeTags): string {
    return `${ensure(metric, "metric")}:${JSON.stringify(tags)}`;
  }
}

export class TrackSyraStatusMapper implements StatusMapperPort {
  map(event: ProviderStatusEvent): NormalizedStatus {
    const raw = event.providerStatus.trim();
    return new NormalizedStatus({
      releaseId: event.releaseId,
      providerReference: event.providerReference,
      canonicalState: this.resolveCanonicalStatus(raw),
      rawStatus: raw,
      source: event.source,
      evidence: event.toEvidence(),
      confidence: event.signatureValid ? 1 : 0.75,
      metadata: freezeRecord({
        providerReference: event.providerReference,
        eventId: event.eventId,
        signatureValid: event.signatureValid,
      }),
    });
  }

  resolveCanonicalStatus(rawStatus: string): DistributionState {
    const normalized = rawStatus.trim().toUpperCase();
    switch (normalized) {
      case "LIVE":
      case "PUBLISHED":
      case "AVAILABLE":
      case "RELEASED":
        return "DSP_LIVE";
      case "ACCEPTED":
      case "ACKNOWLEDGED":
      case "APPROVED":
      case "READY":
        return "DSP_ACCEPTED";
      case "UPLOADING":
      case "DELIVERED":
      case "SUBMITTED":
      case "SUBMITTED_TO_PROVIDER":
      case "SENT":
        return "SUBMITTED_TO_PROVIDER";
      case "PROCESSING":
      case "IN_PROGRESS":
      case "QUEUED":
      case "SYNCING":
        return "PROVIDER_PROCESSING";
      case "PENDING":
      case "SCHEDULED":
        return "PROVIDER_PROCESSING";
      case "REJECTED":
      case "DECLINED":
      case "FAILED":
      case "ERROR":
        return "REJECTED";
      case "CANCELLED":
      case "CANCELED":
        return "CANCELLED";
      case "TAKEDOWN_PENDING":
      case "REMOVAL_PENDING":
        return "TAKEDOWN_PENDING";
      case "TAKEDOWN_COMPLETED":
      case "REMOVED":
      case "TAKEN_DOWN":
        return "TAKEDOWN_COMPLETED";
      case "ROYALTY_READY":
        return "ROYALTY_READY";
      case "ROYALTY_IMPORTED":
        return "ROYALTY_IMPORTED";
      case "STATEMENT_GENERATED":
        return "STATEMENT_GENERATED";
      case "RELEASE_ARCHIVED":
        return "RELEASE_ARCHIVED";
      default:
        return "PROVIDER_PROCESSING";
    }
  }
}

export class TrackSyraStatusNormalizer implements StatusNormalizer {
  constructor(private readonly mapper: StatusMapperPort) {}

  normalize(event: ProviderStatusEvent): NormalizedStatus {
    return this.mapper.map(event);
  }
}

export class TrackSyraTransitionValidator implements TransitionValidator {
  private readonly stateMachine = new DistributionStateMachine();

  validate(currentState: DistributionState | null, next: NormalizedStatus): TransitionValidationResult {
    const valid = currentState === null || currentState === next.canonicalState || this.stateMachine.canTransition(currentState, next.canonicalState);
    return new TransitionValidationResult({
      releaseId: next.releaseId,
      valid,
      previousState: currentState,
      nextState: next.canonicalState,
      reason: valid ? null : `Invalid status transition from ${currentState ?? "null"} to ${next.canonicalState}`,
      metadata: freezeRecord({
        source: next.source,
        rawStatus: next.rawStatus,
      }),
    });
  }
}

export class TrackSyraConflictResolver implements ConflictResolver {
  resolve(input: {
    releaseId: string;
    conflictType: import("../types/statusTypes").StatusConflictType;
    reason?: string | null;
    metadata?: Readonly<Record<string, unknown>>;
  }): ConflictResolution {
    const strategy = this.strategyFor(input.conflictType);
    return new ConflictResolution({
      releaseId: input.releaseId,
      conflictType: input.conflictType,
      strategy,
      resolved: strategy !== "RequireManualReview",
      resolvedAt: strategy !== "RequireManualReview" ? isoNow() : null,
      reason: input.reason ?? null,
      metadata: freezeRecord({
        ...input.metadata,
        strategy,
      }),
    });
  }

  private strategyFor(conflictType: import("../types/statusTypes").StatusConflictType): import("../types/statusTypes").StatusResolutionStrategy {
    switch (conflictType) {
      case "WebhookVsPolling":
        return "PreferWebhook";
      case "DuplicateEvent":
      case "ReplayEvent":
        return "PreferFirst";
      case "OutOfOrderEvent":
      case "LateEvent":
        return "PreferLatest";
      case "MissingEvent":
      default:
        return "RequireManualReview";
    }
  }
}

export class TrackSyraProjectionUpdater implements ProjectionUpdaterPort {
  private readonly projections = new Map<string, ReconciliationResult>();

  update(result: ReconciliationResult): void {
    this.projections.set(result.releaseId, result);
  }

  get(releaseId: string): ReconciliationResult | null {
    return this.projections.get(releaseId) ?? null;
  }
}

export class TrackSyraTimelineUpdater implements TimelineUpdaterPort {
  private readonly timelines = new Map<string, StatusTimeline>();

  update(timeline: StatusTimeline): void {
    this.timelines.set(timeline.releaseId, timeline);
  }

  get(releaseId: string): StatusTimeline | null {
    return this.timelines.get(releaseId) ?? null;
  }
}

export class TrackSyraStatusScheduler implements StatusSchedulerPort {
  nextPollAt(snapshot: StatusSnapshot, lastResult?: PollingResult | null): string | null {
    const state = snapshot.currentState;
    if (new DistributionStateMachine().isTerminal(state)) {
      return null;
    }

    const baseDelayMs = this.delayForState(state);
    const backoffMs = lastResult?.errors.length ? Math.min(15 * 60_000, baseDelayMs * (lastResult.errors.length + 1)) : baseDelayMs;
    return new Date(Date.now() + backoffMs).toISOString();
  }

  shouldPoll(snapshot: StatusSnapshot, now?: string): boolean {
    const nextPollAt = this.nextPollAt(snapshot);
    if (nextPollAt == null) {
      return false;
    }
    const current = now ?? isoNow();
    const lastCaptured = new Date(snapshot.capturedAt).getTime();
    const dueAt = new Date(nextPollAt).getTime();
    return Number.isFinite(lastCaptured) && Number.isFinite(dueAt) ? dueAt <= new Date(current).getTime() : true;
  }

  private delayForState(state: DistributionState): number {
    switch (state) {
      case "DSP_ACCEPTED":
        return 60_000;
      case "DSP_LIVE":
      case "CATALOG_ACTIVE":
        return 15 * 60_000;
      case "PROVIDER_PROCESSING":
      case "SUBMITTED_TO_PROVIDER":
      case "UPLOAD_IN_PROGRESS":
        return 2 * 60_000;
      case "ROYALTY_READY":
      case "ROYALTY_IMPORTED":
        return 30 * 60_000;
      default:
        return 5 * 60_000;
    }
  }
}

export class TrackSyraWebhookSignatureVerifier {
  verify(event: ProviderStatusEvent): boolean {
    return event.signatureValid;
  }
}

export class TrackSyraWebhookAuthenticationVerifier {
  verify(event: ProviderStatusEvent): boolean {
    return event.signatureValid && Boolean(event.headers);
  }
}

export class TrackSyraWebhookPayloadValidator {
  validate(event: ProviderStatusEvent): boolean {
    return [event.eventId, event.releaseId, event.providerReference, event.providerStatus].every((value) => trim(value).length > 0);
  }
}

export class TrackSyraWebhookEventParser {
  parse(input: ProviderStatusEvent | Readonly<Record<string, unknown>>): ProviderStatusEvent {
    if (input instanceof ProviderStatusEvent) {
      return input;
    }

    return new ProviderStatusEvent({
      eventId: String(input.eventId ?? input.id ?? "").trim(),
      releaseId: String(input.releaseId ?? "").trim(),
      providerReference: String(input.providerReference ?? input.provider ?? "").trim(),
      providerStatus: String(input.providerStatus ?? input.status ?? "").trim(),
      source: (String(input.source ?? "WEBHOOK").toUpperCase() as StatusSyncSource) || "WEBHOOK",
      receivedAt: typeof input.receivedAt === "string" ? input.receivedAt : isoNow(),
      headers: typeof input.headers === "object" && input.headers != null ? (input.headers as Readonly<Record<string, string>>) : {},
      payload: typeof input.payload === "object" && input.payload != null ? (input.payload as Readonly<Record<string, unknown>>) : {},
      signatureValid: Boolean(input.signatureValid ?? false),
      metadata: typeof input.metadata === "object" && input.metadata != null ? (input.metadata as Readonly<Record<string, unknown>>) : {},
    });
  }
}

export class TrackSyraWebhookEventNormalizer {
  constructor(private readonly normalizer: StatusNormalizer) {}

  normalize(event: ProviderStatusEvent): NormalizedStatus {
    return this.normalizer.normalize(event);
  }
}

export class TrackSyraWebhookDuplicateDetector {
  private readonly seen = new Set<string>();

  isDuplicate(event: ProviderStatusEvent): boolean {
    const key = this.key(event);
    if (this.seen.has(key)) {
      return true;
    }
    this.seen.add(key);
    return false;
  }

  private key(event: ProviderStatusEvent): string {
    return `${event.releaseId}:${event.providerReference}:${event.eventId}`;
  }
}

export class TrackSyraWebhookReplayProtection {
  private readonly seen = new Set<string>();

  isReplay(event: ProviderStatusEvent): boolean {
    const key = `${event.releaseId}:${event.eventId}`;
    if (this.seen.has(key)) {
      return true;
    }
    this.seen.add(key);
    return false;
  }
}

export class TrackSyraWebhookEventOrdering {
  private readonly lastSeenAt = new Map<string, string>();

  isOrdered(event: ProviderStatusEvent): boolean {
    const key = `${event.releaseId}:${event.providerReference}`;
    const last = this.lastSeenAt.get(key);
    if (last != null && event.receivedAt < last) {
      return false;
    }
    this.lastSeenAt.set(key, event.receivedAt);
    return true;
  }
}

export class TrackSyraWebhookIdempotencyManager {
  private readonly processed = new Set<string>();

  isProcessed(event: ProviderStatusEvent): boolean {
    const key = `${event.releaseId}:${event.providerReference}:${event.eventId}`;
    if (this.processed.has(key)) {
      return true;
    }
    this.processed.add(key);
    return false;
  }
}

export class TrackSyraWebhookDeadLetterRouter {
  private readonly deadLetters: RuntimeDeadLetter[] = [];

  route(event: ProviderStatusEvent, reason: string, metadata: Readonly<Record<string, unknown>> = {}): void {
    this.deadLetters.push(Object.freeze({
      kind: "webhook",
      reason: ensure(reason, "reason"),
      releaseId: event.releaseId,
      createdAt: isoNow(),
      eventId: event.eventId,
      providerReference: event.providerReference,
      metadata: freezeRecord(metadata),
    }));
  }

  list(): readonly RuntimeDeadLetter[] {
    return this.deadLetters;
  }
}

export class TrackSyraWebhookRetryQueue {
  private readonly retries: RuntimeRetry[] = [];

  enqueue(event: WebhookEvent, attempts = 0, nextAttemptAt: string | null = null, metadata: Readonly<Record<string, unknown>> = {}): void {
    this.retries.push(Object.freeze({
      kind: "webhook",
      attempts,
      nextAttemptAt,
      payload: event,
      createdAt: isoNow(),
      metadata: freezeRecord(metadata),
    }));
  }

  list(): readonly RuntimeRetry[] {
    return this.retries;
  }
}

export class TrackSyraWebhookFailureRecovery {
  constructor(
    private readonly retryQueue: TrackSyraWebhookRetryQueue,
    private readonly deadLetterRouter: TrackSyraWebhookDeadLetterRouter,
  ) {}

  recover(event: WebhookEvent, error: Error): void {
    this.retryQueue.enqueue(event, 1, isoNow(), { error: error.message });
    this.deadLetterRouter.route(event.providerStatusEvent, error.message, { webhookId: event.webhookId });
  }
}

export class TrackSyraWebhookAuditLogger {
  private readonly auditTrail: Readonly<Record<string, unknown>>[] = [];

  record(category: StatusEventCategory, payload: Readonly<Record<string, unknown>>): void {
    this.auditTrail.push(Object.freeze({
      category,
      payload: freezeRecord(payload),
      recordedAt: isoNow(),
    }));
  }

  list(): readonly Readonly<Record<string, unknown>>[] {
    return Object.freeze([...this.auditTrail]);
  }
}

export class TrackSyraWebhookRegistry {
  private readonly handlers = new Map<string, RuntimeWebhookHandler>();

  register(name: string, handler: RuntimeWebhookHandler): void {
    this.handlers.set(ensure(name, "name"), handler);
  }

  resolve(name: string): RuntimeWebhookHandler | null {
    return this.handlers.get(name) ?? null;
  }

  list(): readonly string[] {
    return Object.freeze([...this.handlers.keys()]);
  }
}

export class TrackSyraWebhookRouter {
  constructor(private readonly registry: TrackSyraWebhookRegistry) {}

  route(event: WebhookEvent): RuntimeWebhookHandler | null {
    return this.registry.resolve(event.providerStatusEvent.providerReference) ?? this.registry.resolve("*");
  }
}

export class TrackSyraWebhookDispatcher {
  constructor(
    private readonly router: TrackSyraWebhookRouter,
    private readonly validator: TrackSyraWebhookValidator,
    private readonly receiver: TrackSyraWebhookReceiver,
    private readonly logger: StatusLoggerPort,
    private readonly metrics: StatusMetricsPort,
  ) {}

  async dispatch(input: ProviderStatusEvent | WebhookEvent | Readonly<Record<string, unknown>>): Promise<ReconciliationResult> {
    const webhook = this.receiver.receive(input);
    if (!this.validator.validate(webhook)) {
      this.metrics.increment("status_sync.webhook.invalid");
      throw new Error(`Invalid webhook event: ${webhook.webhookId}`);
    }

    const handler = this.router.route(webhook);
    if (!handler) {
      this.metrics.increment("status_sync.webhook.unrouted");
      throw new Error(`No webhook handler registered for ${webhook.providerStatusEvent.providerReference}`);
    }

    this.logger.info("Dispatching webhook event", {
      webhookId: webhook.webhookId,
      releaseId: webhook.providerStatusEvent.releaseId,
      providerReference: webhook.providerStatusEvent.providerReference,
    });
    this.metrics.increment("status_sync.webhook.dispatched");
    return await Promise.resolve(handler(webhook));
  }
}

export class TrackSyraWebhookReceiver {
  constructor(
    private readonly parser: TrackSyraWebhookEventParser,
    private readonly signatureVerifier: TrackSyraWebhookSignatureVerifier,
    private readonly authenticationVerifier: TrackSyraWebhookAuthenticationVerifier,
    private readonly payloadValidator: TrackSyraWebhookPayloadValidator,
    private readonly logger: StatusLoggerPort,
  ) {}

  receive(input: ProviderStatusEvent | WebhookEvent | Readonly<Record<string, unknown>>): WebhookEvent {
    if (input instanceof WebhookEvent) {
      return input;
    }

    const providerStatusEvent = input instanceof ProviderStatusEvent ? input : this.parser.parse(input);
    const validationPassed = this.signatureVerifier.verify(providerStatusEvent)
      && this.authenticationVerifier.verify(providerStatusEvent)
      && this.payloadValidator.validate(providerStatusEvent);

    this.logger.debug("Webhook received", {
      webhookId: providerStatusEvent.eventId,
      releaseId: providerStatusEvent.releaseId,
      providerReference: providerStatusEvent.providerReference,
      validationPassed,
    });

    return new WebhookEvent({
      webhookId: providerStatusEvent.eventId,
      providerStatusEvent,
      signatureValidatedAt: validationPassed ? isoNow() : null,
      validationPassed,
      metadata: freezeRecord({
        source: providerStatusEvent.source,
        providerStatus: providerStatusEvent.providerStatus,
      }),
    });
  }
}

export class TrackSyraWebhookValidator {
  constructor(
    private readonly signatureVerifier: TrackSyraWebhookSignatureVerifier,
    private readonly authenticationVerifier: TrackSyraWebhookAuthenticationVerifier,
    private readonly payloadValidator: TrackSyraWebhookPayloadValidator,
    private readonly duplicateDetector: TrackSyraWebhookDuplicateDetector,
    private readonly replayProtection: TrackSyraWebhookReplayProtection,
    private readonly ordering: TrackSyraWebhookEventOrdering,
  ) {}

  validate(event: WebhookEvent): boolean {
    const providerEvent = event.providerStatusEvent;
    return Boolean(event.validationPassed)
      && this.signatureVerifier.verify(providerEvent)
      && this.authenticationVerifier.verify(providerEvent)
      && this.payloadValidator.validate(providerEvent)
      && !this.duplicateDetector.isDuplicate(providerEvent)
      && !this.replayProtection.isReplay(providerEvent)
      && this.ordering.isOrdered(providerEvent);
  }
}

export class TrackSyraPollingRegistry {
  private readonly handlers = new Map<string, RuntimePollingHandler>();

  register(name: string, handler: RuntimePollingHandler): void {
    this.handlers.set(ensure(name, "name"), handler);
  }

  resolve(name: string): RuntimePollingHandler | null {
    return this.handlers.get(name) ?? this.handlers.get("*") ?? null;
  }

  list(): readonly string[] {
    return Object.freeze([...this.handlers.keys()]);
  }
}

export class TrackSyraPollingStrategyResolver {
  resolve(snapshot: StatusSnapshot): "adaptive" | "incremental" | "batch" | "parallel" | "scheduled" | "immediate" {
    const state = snapshot.currentState;
    if (new DistributionStateMachine().isTerminal(state)) {
      return "scheduled";
    }
    if (state === "PROVIDER_PROCESSING" || state === "SUBMITTED_TO_PROVIDER" || state === "UPLOAD_IN_PROGRESS") {
      return "incremental";
    }
    if (state === "DSP_ACCEPTED" || state === "DSP_LIVE") {
      return "adaptive";
    }
    if (snapshot.version > 1) {
      return "batch";
    }
    return "immediate";
  }
}

export class TrackSyraPollingExecutor {
  constructor(
    private readonly mapper: StatusMapperPort,
    private readonly scheduler: StatusSchedulerPort,
    private readonly metrics: StatusMetricsPort,
    private readonly logger: StatusLoggerPort,
    private readonly strategyResolver: TrackSyraPollingStrategyResolver,
  ) {}

  execute(input: {
    releaseId: string;
    providerReference?: string | null;
    snapshot: StatusSnapshot;
  }): PollingResult {
    const strategy = this.strategyResolver.resolve(input.snapshot);
    const providerStatus = String(input.snapshot.metadata.providerStatus ?? input.snapshot.current.rawStatus ?? input.snapshot.current.canonicalState);
    const syntheticEvent = new ProviderStatusEvent({
      eventId: `poll:${input.releaseId}:${input.snapshot.version}`,
      releaseId: input.releaseId,
      providerReference: input.providerReference ?? input.snapshot.providerReference ?? "unknown-provider",
      providerStatus,
      source: "POLLING",
      signatureValid: true,
      receivedAt: isoNow(),
      payload: freezeRecord({
        strategy,
        releaseId: input.releaseId,
        snapshotVersion: input.snapshot.version,
      }),
      metadata: freezeRecord({
        strategy,
        providerReference: input.providerReference ?? input.snapshot.providerReference,
      }),
    });
    const normalized = this.mapper.map(syntheticEvent);
    const changesDetected = normalized.canonicalState !== input.snapshot.currentState || Boolean(input.snapshot.previous && input.snapshot.previous.canonicalState !== normalized.canonicalState);
    const transitions = changesDetected
      ? [
          new StatusTransition({
            releaseId: input.releaseId,
            from: input.snapshot.currentState,
            to: normalized.canonicalState,
            source: "POLLING",
            reason: providerStatus,
            metadata: freezeRecord({
              strategy,
              providerReference: input.providerReference ?? input.snapshot.providerReference,
            }),
          }),
        ]
      : [];
    const nextPollAt = this.scheduler.nextPollAt(input.snapshot);
    this.metrics.increment("status_sync.poll.executed");
    this.logger.debug("Polling executed", {
      releaseId: input.releaseId,
      providerReference: input.providerReference ?? input.snapshot.providerReference,
      strategy,
      changesDetected,
    });
    return new PollingResult({
      releaseId: input.releaseId,
      providerReference: input.providerReference ?? input.snapshot.providerReference,
      polledAt: isoNow(),
      snapshot: input.snapshot,
      changesDetected,
      transitions,
      nextPollAt,
      warnings: changesDetected ? [] : ["No status changes detected"],
      errors: [],
      metadata: freezeRecord({
        strategy,
        canonicalState: normalized.canonicalState,
      }),
    });
  }
}

export class TrackSyraPollingDispatcher {
  constructor(
    private readonly registry: TrackSyraPollingRegistry,
    private readonly executor: TrackSyraPollingExecutor,
    private readonly logger: StatusLoggerPort,
    private readonly metrics: StatusMetricsPort,
  ) {}

  dispatch(input: {
    releaseId: string;
    providerReference?: string | null;
    snapshot: StatusSnapshot;
  }): Promise<PollingResult> | PollingResult {
    const handler = this.registry.resolve(input.providerReference ?? "*");
    if (handler) {
      this.metrics.increment("status_sync.poll.handled_by_registry");
      this.logger.info("Dispatching polling via registry handler", {
        releaseId: input.releaseId,
        providerReference: input.providerReference ?? input.snapshot.providerReference,
      });
      return Promise.resolve(handler(input));
    }

    this.metrics.increment("status_sync.poll.executed_by_default");
    return this.executor.execute(input);
  }
}

export class TrackSyraPollingHealthMonitor {
  private readonly lastHealthCheck = new Map<string, boolean>();

  update(releaseId: string, healthy: boolean): void {
    this.lastHealthCheck.set(ensure(releaseId, "releaseId"), healthy);
  }

  isHealthy(releaseId: string): boolean {
    return this.lastHealthCheck.get(ensure(releaseId, "releaseId")) ?? true;
  }
}

export class TrackSyraPollingProcessor implements PollingProcessor {
  constructor(private readonly dispatcher: TrackSyraPollingDispatcher) {}

  poll(input: {
    releaseId: string;
    providerReference?: string | null;
    snapshot: StatusSnapshot;
  }): Promise<PollingResult> | PollingResult {
    return this.dispatcher.dispatch(input);
  }
}

export class TrackSyraWebhookProcessor implements WebhookProcessor {
  constructor(
    private readonly dispatcher: TrackSyraWebhookDispatcher,
    private readonly normalizer: StatusNormalizer,
    private readonly validator: TransitionValidator,
    private readonly reconciliationEngine: ReconciliationEngine,
    private readonly projectionUpdater: ProjectionUpdaterPort,
    private readonly timelineUpdater: TimelineUpdaterPort,
    private readonly eventPublisher: StatusSyncEventPublisher,
    private readonly metrics: StatusMetricsPort,
    private readonly logger: StatusLoggerPort,
    private readonly conflictResolver: ConflictResolver,
  ) {}

  async process(input: WebhookEvent): Promise<ReconciliationResult> {
    this.eventPublisher.publish({ type: "WebhookReceived", payload: { event: input.providerStatusEvent } });
    this.metrics.increment("status_sync.webhook.received");
    this.logger.info("Webhook processing started", {
      webhookId: input.webhookId,
      releaseId: input.providerStatusEvent.releaseId,
      providerReference: input.providerStatusEvent.providerReference,
    });

    const normalized = this.normalizer.normalize(input.providerStatusEvent);
    const validation = this.validator.validate(null, normalized);
    const conflictResolution = validation.valid
      ? null
      : this.conflictResolver.resolve({
          releaseId: normalized.releaseId,
          conflictType: "WebhookVsPolling",
          reason: validation.reason,
          metadata: freezeRecord({ webhookId: input.webhookId }),
        });

    const snapshot = new StatusSnapshot({
      releaseId: normalized.releaseId,
      providerReference: normalized.providerReference,
      current: normalized,
      evidence: [input.providerStatusEvent.toEvidence()],
      metadata: freezeRecord({
        webhookId: input.webhookId,
        signatureValidatedAt: input.signatureValidatedAt,
        validationPassed: input.validationPassed,
      }),
    });

    const transition = validation.valid
      ? new StatusTransition({
          releaseId: normalized.releaseId,
          from: normalized.canonicalState,
          to: normalized.canonicalState,
          source: normalized.source,
          reason: normalized.rawStatus,
          metadata: freezeRecord({
            webhookId: input.webhookId,
            providerReference: normalized.providerReference,
          }),
        })
      : null;

    const result = await Promise.resolve(this.reconciliationEngine.reconcile({
      snapshot,
      normalizedStatus: normalized,
      transition,
    }));

    this.projectionUpdater.update(result);
    this.timelineUpdater.update(new StatusTimeline({
      releaseId: normalized.releaseId,
      events: transition ? [transition] : [],
      metadata: freezeRecord({
        webhookId: input.webhookId,
        providerReference: normalized.providerReference,
      }),
    }));
    this.eventPublisher.publish({
      type: validation.valid ? "TransitionValidated" : "TransitionRejected",
      payload: {
        webhookId: input.webhookId,
        releaseId: normalized.releaseId,
        providerReference: normalized.providerReference,
        reason: validation.reason,
      },
    });
    return result;
  }
}

export class TrackSyraReconciliationEngine implements ReconciliationEngine {
  constructor(
    private readonly transitionValidator: TransitionValidator,
    private readonly conflictResolver: ConflictResolver,
  ) {}

  reconcile(input: {
    snapshot: StatusSnapshot;
    normalizedStatus: NormalizedStatus;
    transition?: StatusTransition | null;
  }): ReconciliationResult {
    const validation = this.transitionValidator.validate(input.snapshot.currentState, input.normalizedStatus);
    const transition = input.transition ?? (validation.valid ? new StatusTransition({
      releaseId: input.snapshot.releaseId,
      from: input.snapshot.currentState,
      to: input.normalizedStatus.canonicalState,
      source: input.normalizedStatus.source,
      reason: input.normalizedStatus.rawStatus,
      metadata: freezeRecord({
        providerReference: input.snapshot.providerReference,
      }),
    }) : null);

    const conflictResolution = validation.valid
      ? null
      : this.conflictResolver.resolve({
          releaseId: input.snapshot.releaseId,
          conflictType: "WebhookVsPolling",
          reason: validation.reason,
          metadata: freezeRecord({
            currentState: input.snapshot.currentState,
            nextState: input.normalizedStatus.canonicalState,
          }),
        });

    return new ReconciliationResult({
      releaseId: input.snapshot.releaseId,
      success: validation.valid || input.snapshot.currentState === input.normalizedStatus.canonicalState,
      snapshot: input.snapshot,
      normalizedStatus: input.normalizedStatus,
      transition,
      conflictResolution,
      warnings: validation.valid ? [] : [validation.reason ?? "Transition rejected"],
      errors: validation.valid ? [] : [validation.reason ?? "Transition rejected"],
      metadata: freezeRecord({
        source: input.normalizedStatus.source,
        validator: "TrackSyraTransitionValidator",
      }),
    });
  }
}

export class TrackSyraStatusEventPublisher implements StatusSyncEventPublisher {
  private readonly events: (
    | { type: "WebhookReceived"; payload: Readonly<{ event: ProviderStatusEvent }> }
    | { type: "PollingStarted"; payload: Readonly<Record<string, unknown>> }
    | { type: "PollingCompleted"; payload: Readonly<Record<string, unknown>> }
    | { type: "StatusNormalized"; payload: Readonly<Record<string, unknown>> }
    | { type: "TransitionValidated"; payload: Readonly<Record<string, unknown>> }
    | { type: "TransitionRejected"; payload: Readonly<Record<string, unknown>> }
    | { type: "StateTransitionRequested"; payload: Readonly<Record<string, unknown>> }
    | { type: "ProjectionUpdated"; payload: Readonly<Record<string, unknown>> }
    | { type: "TimelineUpdated"; payload: Readonly<Record<string, unknown>> }
    | { type: "ConflictDetected"; payload: Readonly<Record<string, unknown>> }
    | { type: "ConflictResolved"; payload: Readonly<Record<string, unknown>> }
  )[] = [];

  publish(event:
    | { type: "WebhookReceived"; payload: Readonly<{ event: ProviderStatusEvent }> }
    | { type: "PollingStarted"; payload: Readonly<Record<string, unknown>> }
    | { type: "PollingCompleted"; payload: Readonly<Record<string, unknown>> }
    | { type: "StatusNormalized"; payload: Readonly<Record<string, unknown>> }
    | { type: "TransitionValidated"; payload: Readonly<Record<string, unknown>> }
    | { type: "TransitionRejected"; payload: Readonly<Record<string, unknown>> }
    | { type: "StateTransitionRequested"; payload: Readonly<Record<string, unknown>> }
    | { type: "ProjectionUpdated"; payload: Readonly<Record<string, unknown>> }
    | { type: "TimelineUpdated"; payload: Readonly<Record<string, unknown>> }
    | { type: "ConflictDetected"; payload: Readonly<Record<string, unknown>> }
    | { type: "ConflictResolved"; payload: Readonly<Record<string, unknown>> },
  ): void {
    this.events.push(Object.freeze({
      type: event.type,
      payload: freezeRecord(event.payload),
    }) as typeof event);
  }

  list(): readonly typeof this.events[number][] {
    return Object.freeze([...this.events]);
  }
}

export type StatusSyncRuntimeDependencies = Readonly<{
  logger: TrackSyraStatusLogger;
  metrics: TrackSyraStatusMetrics;
  eventPublisher: TrackSyraStatusEventPublisher;
  webhookRegistry: TrackSyraWebhookRegistry;
  pollingRegistry: TrackSyraPollingRegistry;
  scheduler: TrackSyraStatusScheduler;
  mapper: TrackSyraStatusMapper;
  normalizer: TrackSyraStatusNormalizer;
  validator: TrackSyraTransitionValidator;
  conflictResolver: TrackSyraConflictResolver;
  reconciliationEngine: TrackSyraReconciliationEngine;
  projectionUpdater: TrackSyraProjectionUpdater;
  timelineUpdater: TrackSyraTimelineUpdater;
  bridge: DistributionStatusSyncEngineBridge;
  deadLetterRouter: TrackSyraWebhookDeadLetterRouter;
  retryQueue: TrackSyraWebhookRetryQueue;
  failureRecovery: TrackSyraWebhookFailureRecovery;
  auditLogger: TrackSyraWebhookAuditLogger;
  healthMonitor: TrackSyraPollingHealthMonitor;
  webhookReceiver: TrackSyraWebhookReceiver;
  webhookValidator: TrackSyraWebhookValidator;
  webhookDispatcher: TrackSyraWebhookDispatcher;
  pollingExecutor: TrackSyraPollingExecutor;
  pollingDispatcher: TrackSyraPollingDispatcher;
  webhookProcessor: TrackSyraWebhookProcessor;
  pollingProcessor: TrackSyraPollingProcessor;
}>;

export class TrackSyraStatusSyncRuntimeEngine implements StatusSyncEngine {
  readonly webhookRegistry: TrackSyraWebhookRegistry;
  readonly pollingRegistry: TrackSyraPollingRegistry;
  readonly webhookReceiver: TrackSyraWebhookReceiver;
  readonly webhookValidator: TrackSyraWebhookValidator;
  readonly webhookDispatcher: TrackSyraWebhookDispatcher;
  readonly pollingDispatcher: TrackSyraPollingDispatcher;
  readonly pollingExecutor: TrackSyraPollingExecutor;
  readonly webhookProcessor: TrackSyraWebhookProcessor;
  readonly pollingProcessor: TrackSyraPollingProcessor;
  readonly projectionUpdater: TrackSyraProjectionUpdater;
  readonly timelineUpdater: TrackSyraTimelineUpdater;
  readonly scheduler: TrackSyraStatusScheduler;
  readonly metrics: TrackSyraStatusMetrics;
  readonly logger: TrackSyraStatusLogger;
  readonly eventPublisher: TrackSyraStatusEventPublisher;
  readonly mapper: TrackSyraStatusMapper;
  readonly normalizer: TrackSyraStatusNormalizer;
  readonly validator: TrackSyraTransitionValidator;
  readonly reconciliationEngine: TrackSyraReconciliationEngine;
  readonly conflictResolver: TrackSyraConflictResolver;
  readonly bridge: DistributionStatusSyncEngineBridge;
  readonly deadLetterRouter: TrackSyraWebhookDeadLetterRouter;
  readonly retryQueue: TrackSyraWebhookRetryQueue;
  readonly failureRecovery: TrackSyraWebhookFailureRecovery;
  readonly auditLogger: TrackSyraWebhookAuditLogger;
  readonly healthMonitor: TrackSyraPollingHealthMonitor;

  constructor(dependencies: StatusSyncRuntimeDependencies) {
    this.logger = dependencies.logger;
    this.metrics = dependencies.metrics;
    this.eventPublisher = dependencies.eventPublisher;
    this.webhookRegistry = dependencies.webhookRegistry;
    this.pollingRegistry = dependencies.pollingRegistry;
    this.scheduler = dependencies.scheduler;
    this.mapper = dependencies.mapper;
    this.normalizer = dependencies.normalizer;
    this.validator = dependencies.validator;
    this.conflictResolver = dependencies.conflictResolver;
    this.reconciliationEngine = dependencies.reconciliationEngine;
    this.projectionUpdater = dependencies.projectionUpdater;
    this.timelineUpdater = dependencies.timelineUpdater;
    this.bridge = dependencies.bridge;
    this.deadLetterRouter = dependencies.deadLetterRouter;
    this.retryQueue = dependencies.retryQueue;
    this.failureRecovery = dependencies.failureRecovery;
    this.auditLogger = dependencies.auditLogger;
    this.healthMonitor = dependencies.healthMonitor;
    this.webhookReceiver = dependencies.webhookReceiver;
    this.webhookValidator = dependencies.webhookValidator;
    this.webhookDispatcher = dependencies.webhookDispatcher;
    this.pollingExecutor = dependencies.pollingExecutor;
    this.pollingDispatcher = dependencies.pollingDispatcher;
    this.webhookProcessor = dependencies.webhookProcessor;
    this.pollingProcessor = dependencies.pollingProcessor;
  }

  async synchronize(input: {
    webhook?: WebhookEvent | null;
    polling?: PollingResult | null;
    snapshot: StatusSnapshot;
  }): Promise<ReconciliationResult> {
    const source = input.webhook ? "WEBHOOK" : "POLLING";
    if (source === "WEBHOOK") {
      this.eventPublisher.publish({
        type: "WebhookReceived",
        payload: {
          event: input.webhook?.providerStatusEvent ?? createFallbackProviderStatusEvent(input.snapshot, source),
        },
      });
    } else {
      this.eventPublisher.publish({
        type: "PollingStarted",
        payload: {
          releaseId: input.snapshot.releaseId,
          providerReference: input.snapshot.providerReference,
          source,
        },
      });
    }

    const resolvedPolling = input.webhook
      ? null
      : await Promise.resolve(input.polling ?? this.pollingDispatcher.dispatch({
          releaseId: input.snapshot.releaseId,
          providerReference: input.snapshot.providerReference,
          snapshot: input.snapshot,
        }));

    const processed = input.webhook
      ? await this.webhookDispatcher.dispatch(input.webhook)
      : await this.reconcilePolling(resolvedPolling as PollingResult);

    this.eventPublisher.publish({
      type: "StatusNormalized",
      payload: {
        releaseId: processed.releaseId,
        source,
        canonicalState: processed.normalizedStatus.canonicalState,
      },
    });

    await this.bridge.synchronize({
      webhook: input.webhook ?? null,
      polling: resolvedPolling,
      snapshot: input.snapshot,
    });

    this.eventPublisher.publish({
      type: "StateTransitionRequested",
      payload: {
        releaseId: input.snapshot.releaseId,
        source,
      },
    });

    this.projectionUpdater.update(processed);
    this.timelineUpdater.update(new StatusTimeline({
      releaseId: processed.releaseId,
      events: processed.transition ? [processed.transition] : [],
      metadata: freezeRecord({
        source,
      }),
    }));
    this.eventPublisher.publish({
      type: "ProjectionUpdated",
      payload: {
        releaseId: input.snapshot.releaseId,
        source,
      },
    });
    this.eventPublisher.publish({
      type: "TimelineUpdated",
      payload: {
        releaseId: input.snapshot.releaseId,
        source,
      },
    });
    if (source === "POLLING") {
      this.eventPublisher.publish({
        type: "PollingCompleted",
        payload: {
          releaseId: input.snapshot.releaseId,
          source,
          canonicalState: processed.normalizedStatus.canonicalState,
        },
      });
    }

    return processed;
  }

  private async reconcilePolling(polling: PollingResult): Promise<ReconciliationResult> {
    const current = polling.snapshot.current;
    const validation = this.validator.validate(polling.snapshot.currentState, current);
    const conflict = validation.valid
      ? null
      : this.conflictResolver.resolve({
          releaseId: polling.releaseId,
          conflictType: "WebhookVsPolling",
          reason: validation.reason,
          metadata: freezeRecord({ source: "POLLING" }),
        });
    return await Promise.resolve(new ReconciliationResult({
      releaseId: polling.releaseId,
      success: validation.valid || polling.snapshot.currentState === current.canonicalState,
      snapshot: polling.snapshot,
      normalizedStatus: current,
      transition: polling.transitions[0] ?? null,
      conflictResolution: conflict,
      warnings: polling.warnings,
      errors: polling.errors,
      metadata: freezeRecord({
        source: "POLLING",
        nextPollAt: polling.nextPollAt,
      }),
    }));
  }
}
