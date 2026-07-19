import { DistributionStateMachine } from "../../domain/index.js";
import { ConflictResolution } from "../conflict/conflictResolution.js";
import { NormalizedStatus } from "../normalization/normalizedStatus.js";
import { PollingResult } from "../polling/pollingResult.js";
import { ReconciliationResult } from "../reconciliation/reconciliationResult.js";
import { StatusSnapshot } from "../snapshot/statusSnapshot.js";
import { StatusTimeline } from "../timeline/statusTimeline.js";
import { StatusTransition } from "../types/statusTypes.js";
import { TransitionValidationResult } from "../validation/transitionValidation.js";
import { ProviderStatusEvent } from "../events/providerStatusEvent.js";
import { WebhookEvent } from "../webhooks/webhookEvent.js";
function isoNow() {
    return new Date().toISOString();
}
function freezeRecord(value) {
    return Object.freeze({ ...value });
}
function trim(value) {
    return value.trim();
}
function ensure(value, field) {
    const trimmed = trim(value);
    if (!trimmed) {
        throw new Error(`${field} must not be empty`);
    }
    return trimmed;
}
function safeTags(tags) {
    return Object.freeze({ ...(tags ?? {}) });
}
function createFallbackProviderStatusEvent(snapshot, source) {
    return new ProviderStatusEvent({
        eventId: `${snapshot.releaseId}:webhook`,
        releaseId: snapshot.releaseId,
        providerReference: snapshot.providerReference ?? "unknown",
        providerStatus: snapshot.currentState,
        source,
    });
}
export class TrackSyraStatusLogger {
    entries = [];
    log(level, message, context) {
        const entry = Object.freeze({
            level,
            message: ensure(message, "message"),
            context: freezeRecord(context ?? {}),
            recordedAt: isoNow(),
        });
        this.entries.push(entry);
    }
    debug(message, context) {
        this.log("debug", message, context);
    }
    info(message, context) {
        this.log("info", message, context);
    }
    warn(message, context) {
        this.log("warn", message, context);
    }
    error(message, context) {
        this.log("error", message, context);
    }
    list() {
        return Object.freeze([...this.entries]);
    }
}
export class TrackSyraStatusMetrics {
    counters = new Map();
    gauges = new Map();
    observations = new Map();
    increment(metric, value = 1, tags = {}) {
        const key = this.key(metric, tags);
        this.counters.set(key, (this.counters.get(key) ?? 0) + value);
    }
    observe(metric, value, tags = {}) {
        const key = this.key(metric, tags);
        const current = this.observations.get(key) ?? [];
        this.observations.set(key, Object.freeze([...current, value]));
    }
    gauge(metric, value, tags = {}) {
        const key = this.key(metric, tags);
        this.gauges.set(key, value);
    }
    snapshot() {
        return freezeRecord({
            counters: Object.freeze(Object.fromEntries(this.counters.entries())),
            gauges: Object.freeze(Object.fromEntries(this.gauges.entries())),
            observations: Object.freeze(Object.fromEntries(this.observations.entries())),
        });
    }
    key(metric, tags) {
        return `${ensure(metric, "metric")}:${JSON.stringify(tags)}`;
    }
}
export class TrackSyraStatusMapper {
    map(event) {
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
    resolveCanonicalStatus(rawStatus) {
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
export class TrackSyraStatusNormalizer {
    mapper;
    constructor(mapper) {
        this.mapper = mapper;
    }
    normalize(event) {
        return this.mapper.map(event);
    }
}
export class TrackSyraTransitionValidator {
    stateMachine = new DistributionStateMachine();
    validate(currentState, next) {
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
export class TrackSyraConflictResolver {
    resolve(input) {
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
    strategyFor(conflictType) {
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
export class TrackSyraProjectionUpdater {
    projections = new Map();
    update(result) {
        this.projections.set(result.releaseId, result);
    }
    get(releaseId) {
        return this.projections.get(releaseId) ?? null;
    }
}
export class TrackSyraTimelineUpdater {
    timelines = new Map();
    update(timeline) {
        this.timelines.set(timeline.releaseId, timeline);
    }
    get(releaseId) {
        return this.timelines.get(releaseId) ?? null;
    }
}
export class TrackSyraStatusScheduler {
    nextPollAt(snapshot, lastResult) {
        const state = snapshot.currentState;
        if (new DistributionStateMachine().isTerminal(state)) {
            return null;
        }
        const baseDelayMs = this.delayForState(state);
        const backoffMs = lastResult?.errors.length ? Math.min(15 * 60_000, baseDelayMs * (lastResult.errors.length + 1)) : baseDelayMs;
        return new Date(Date.now() + backoffMs).toISOString();
    }
    shouldPoll(snapshot, now) {
        const nextPollAt = this.nextPollAt(snapshot);
        if (nextPollAt == null) {
            return false;
        }
        const current = now ?? isoNow();
        const lastCaptured = new Date(snapshot.capturedAt).getTime();
        const dueAt = new Date(nextPollAt).getTime();
        return Number.isFinite(lastCaptured) && Number.isFinite(dueAt) ? dueAt <= new Date(current).getTime() : true;
    }
    delayForState(state) {
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
    verify(event) {
        return event.signatureValid;
    }
}
export class TrackSyraWebhookAuthenticationVerifier {
    verify(event) {
        return event.signatureValid && Boolean(event.headers);
    }
}
export class TrackSyraWebhookPayloadValidator {
    validate(event) {
        return [event.eventId, event.releaseId, event.providerReference, event.providerStatus].every((value) => trim(value).length > 0);
    }
}
export class TrackSyraWebhookEventParser {
    parse(input) {
        if (input instanceof ProviderStatusEvent) {
            return input;
        }
        return new ProviderStatusEvent({
            eventId: String(input.eventId ?? input.id ?? "").trim(),
            releaseId: String(input.releaseId ?? "").trim(),
            providerReference: String(input.providerReference ?? input.provider ?? "").trim(),
            providerStatus: String(input.providerStatus ?? input.status ?? "").trim(),
            source: String(input.source ?? "WEBHOOK").toUpperCase() || "WEBHOOK",
            receivedAt: typeof input.receivedAt === "string" ? input.receivedAt : isoNow(),
            headers: typeof input.headers === "object" && input.headers != null ? input.headers : {},
            payload: typeof input.payload === "object" && input.payload != null ? input.payload : {},
            signatureValid: Boolean(input.signatureValid ?? false),
            metadata: typeof input.metadata === "object" && input.metadata != null ? input.metadata : {},
        });
    }
}
export class TrackSyraWebhookEventNormalizer {
    normalizer;
    constructor(normalizer) {
        this.normalizer = normalizer;
    }
    normalize(event) {
        return this.normalizer.normalize(event);
    }
}
export class TrackSyraWebhookDuplicateDetector {
    seen = new Set();
    isDuplicate(event) {
        const key = this.key(event);
        if (this.seen.has(key)) {
            return true;
        }
        this.seen.add(key);
        return false;
    }
    key(event) {
        return `${event.releaseId}:${event.providerReference}:${event.eventId}`;
    }
}
export class TrackSyraWebhookReplayProtection {
    seen = new Set();
    isReplay(event) {
        const key = `${event.releaseId}:${event.eventId}`;
        if (this.seen.has(key)) {
            return true;
        }
        this.seen.add(key);
        return false;
    }
}
export class TrackSyraWebhookEventOrdering {
    lastSeenAt = new Map();
    isOrdered(event) {
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
    processed = new Set();
    isProcessed(event) {
        const key = `${event.releaseId}:${event.providerReference}:${event.eventId}`;
        if (this.processed.has(key)) {
            return true;
        }
        this.processed.add(key);
        return false;
    }
}
export class TrackSyraWebhookDeadLetterRouter {
    deadLetters = [];
    route(event, reason, metadata = {}) {
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
    list() {
        return this.deadLetters;
    }
}
export class TrackSyraWebhookRetryQueue {
    retries = [];
    enqueue(event, attempts = 0, nextAttemptAt = null, metadata = {}) {
        this.retries.push(Object.freeze({
            kind: "webhook",
            attempts,
            nextAttemptAt,
            payload: event,
            createdAt: isoNow(),
            metadata: freezeRecord(metadata),
        }));
    }
    list() {
        return this.retries;
    }
}
export class TrackSyraWebhookFailureRecovery {
    retryQueue;
    deadLetterRouter;
    constructor(retryQueue, deadLetterRouter) {
        this.retryQueue = retryQueue;
        this.deadLetterRouter = deadLetterRouter;
    }
    recover(event, error) {
        this.retryQueue.enqueue(event, 1, isoNow(), { error: error.message });
        this.deadLetterRouter.route(event.providerStatusEvent, error.message, { webhookId: event.webhookId });
    }
}
export class TrackSyraWebhookAuditLogger {
    auditTrail = [];
    record(category, payload) {
        this.auditTrail.push(Object.freeze({
            category,
            payload: freezeRecord(payload),
            recordedAt: isoNow(),
        }));
    }
    list() {
        return Object.freeze([...this.auditTrail]);
    }
}
export class TrackSyraWebhookRegistry {
    handlers = new Map();
    register(name, handler) {
        this.handlers.set(ensure(name, "name"), handler);
    }
    resolve(name) {
        return this.handlers.get(name) ?? null;
    }
    list() {
        return Object.freeze([...this.handlers.keys()]);
    }
}
export class TrackSyraWebhookRouter {
    registry;
    constructor(registry) {
        this.registry = registry;
    }
    route(event) {
        return this.registry.resolve(event.providerStatusEvent.providerReference) ?? this.registry.resolve("*");
    }
}
export class TrackSyraWebhookDispatcher {
    router;
    validator;
    receiver;
    logger;
    metrics;
    constructor(router, validator, receiver, logger, metrics) {
        this.router = router;
        this.validator = validator;
        this.receiver = receiver;
        this.logger = logger;
        this.metrics = metrics;
    }
    async dispatch(input) {
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
    parser;
    signatureVerifier;
    authenticationVerifier;
    payloadValidator;
    logger;
    constructor(parser, signatureVerifier, authenticationVerifier, payloadValidator, logger) {
        this.parser = parser;
        this.signatureVerifier = signatureVerifier;
        this.authenticationVerifier = authenticationVerifier;
        this.payloadValidator = payloadValidator;
        this.logger = logger;
    }
    receive(input) {
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
    signatureVerifier;
    authenticationVerifier;
    payloadValidator;
    duplicateDetector;
    replayProtection;
    ordering;
    constructor(signatureVerifier, authenticationVerifier, payloadValidator, duplicateDetector, replayProtection, ordering) {
        this.signatureVerifier = signatureVerifier;
        this.authenticationVerifier = authenticationVerifier;
        this.payloadValidator = payloadValidator;
        this.duplicateDetector = duplicateDetector;
        this.replayProtection = replayProtection;
        this.ordering = ordering;
    }
    validate(event) {
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
    handlers = new Map();
    register(name, handler) {
        this.handlers.set(ensure(name, "name"), handler);
    }
    resolve(name) {
        return this.handlers.get(name) ?? this.handlers.get("*") ?? null;
    }
    list() {
        return Object.freeze([...this.handlers.keys()]);
    }
}
export class TrackSyraPollingStrategyResolver {
    resolve(snapshot) {
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
    mapper;
    scheduler;
    metrics;
    logger;
    strategyResolver;
    constructor(mapper, scheduler, metrics, logger, strategyResolver) {
        this.mapper = mapper;
        this.scheduler = scheduler;
        this.metrics = metrics;
        this.logger = logger;
        this.strategyResolver = strategyResolver;
    }
    execute(input) {
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
    registry;
    executor;
    logger;
    metrics;
    constructor(registry, executor, logger, metrics) {
        this.registry = registry;
        this.executor = executor;
        this.logger = logger;
        this.metrics = metrics;
    }
    dispatch(input) {
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
    lastHealthCheck = new Map();
    update(releaseId, healthy) {
        this.lastHealthCheck.set(ensure(releaseId, "releaseId"), healthy);
    }
    isHealthy(releaseId) {
        return this.lastHealthCheck.get(ensure(releaseId, "releaseId")) ?? true;
    }
}
export class TrackSyraPollingProcessor {
    dispatcher;
    constructor(dispatcher) {
        this.dispatcher = dispatcher;
    }
    poll(input) {
        return this.dispatcher.dispatch(input);
    }
}
export class TrackSyraWebhookProcessor {
    dispatcher;
    normalizer;
    validator;
    reconciliationEngine;
    projectionUpdater;
    timelineUpdater;
    eventPublisher;
    metrics;
    logger;
    conflictResolver;
    constructor(dispatcher, normalizer, validator, reconciliationEngine, projectionUpdater, timelineUpdater, eventPublisher, metrics, logger, conflictResolver) {
        this.dispatcher = dispatcher;
        this.normalizer = normalizer;
        this.validator = validator;
        this.reconciliationEngine = reconciliationEngine;
        this.projectionUpdater = projectionUpdater;
        this.timelineUpdater = timelineUpdater;
        this.eventPublisher = eventPublisher;
        this.metrics = metrics;
        this.logger = logger;
        this.conflictResolver = conflictResolver;
    }
    async process(input) {
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
export class TrackSyraReconciliationEngine {
    transitionValidator;
    conflictResolver;
    constructor(transitionValidator, conflictResolver) {
        this.transitionValidator = transitionValidator;
        this.conflictResolver = conflictResolver;
    }
    reconcile(input) {
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
export class TrackSyraStatusEventPublisher {
    events = [];
    publish(event) {
        this.events.push(Object.freeze({
            type: event.type,
            payload: freezeRecord(event.payload),
        }));
    }
    list() {
        return Object.freeze([...this.events]);
    }
}
export class TrackSyraStatusSyncRuntimeEngine {
    webhookRegistry;
    pollingRegistry;
    webhookReceiver;
    webhookValidator;
    webhookDispatcher;
    pollingDispatcher;
    pollingExecutor;
    webhookProcessor;
    pollingProcessor;
    projectionUpdater;
    timelineUpdater;
    scheduler;
    metrics;
    logger;
    eventPublisher;
    mapper;
    normalizer;
    validator;
    reconciliationEngine;
    conflictResolver;
    bridge;
    deadLetterRouter;
    retryQueue;
    failureRecovery;
    auditLogger;
    healthMonitor;
    constructor(dependencies) {
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
    async synchronize(input) {
        const source = input.webhook ? "WEBHOOK" : "POLLING";
        if (source === "WEBHOOK") {
            this.eventPublisher.publish({
                type: "WebhookReceived",
                payload: {
                    event: input.webhook?.providerStatusEvent ?? createFallbackProviderStatusEvent(input.snapshot, source),
                },
            });
        }
        else {
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
            : await this.reconcilePolling(resolvedPolling);
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
    async reconcilePolling(polling) {
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
