import { DistributionStatus } from "../intelligence/distributionStatus.js";
import { AuditRecord } from "../intelligence/audit/auditRecord.js";
import { DashboardProjection as IntelligenceDashboardProjection } from "../intelligence/dashboard/dashboardProjection.js";
import { DistributionProjection } from "../intelligence/projection/distributionProjection.js";
import { ReleaseProjection as IntelligenceReleaseProjection } from "../intelligence/projection/releaseProjection.js";
import { TimelineEntry } from "../intelligence/timeline/timelineEntry.js";
import { AnalyticsSnapshot } from "../intelligence/snapshots/analyticsSnapshot.js";
import { ProjectionCheckpoint } from "../intelligence/snapshots/projectionCheckpoint.js";
import { ReconciliationResult } from "./reconciliation/reconciliationResult.js";
import { StatusSnapshot } from "./snapshot/statusSnapshot.js";
import { StatusTimeline } from "./timeline/statusTimeline.js";
import { WebhookEvent } from "./webhooks/webhookEvent.js";
import { PollingResult } from "./polling/pollingResult.js";
import { StatusTransition } from "./types/statusTypes.js";
import { serializeCanonicalJSON } from "../core/canonicalSerializer.js";
import { TrackSyraStatusMetrics, TrackSyraStatusLogger, TrackSyraStatusSyncRuntimeEngine } from "./runtime/statusSyncRuntime.js";
function isoNow() {
    return new Date().toISOString();
}
function freezeRecord(value) {
    return Object.freeze({ ...value });
}
function ensure(value, field) {
    const trimmed = value.trim();
    if (!trimmed) {
        throw new Error(`${field} must not be empty`);
    }
    return trimmed;
}
function mapStateToDistributionStatus(state) {
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
    values;
    constructor(values) {
        this.values = values;
    }
    register(key, runtime) {
        this.values.set(ensure(key, "key"), runtime);
    }
    resolve(key) {
        return this.values.get(ensure(key, "key")) ?? this.values.get("*") ?? null;
    }
    list() {
        return Object.freeze([...this.values.keys()]);
    }
}
export class StateSnapshotManager {
    snapshots;
    constructor(snapshots) {
        this.snapshots = snapshots;
    }
    store(snapshot) {
        this.snapshots.set(snapshot.releaseId, snapshot);
    }
    resolve(releaseId) {
        return this.snapshots.get(ensure(releaseId, "releaseId")) ?? null;
    }
    list() {
        return Object.freeze([...this.snapshots.values()]);
    }
}
export class StateHistoryManager {
    history;
    constructor(history) {
        this.history = history;
    }
    append(releaseId, transition) {
        const key = ensure(releaseId, "releaseId");
        const current = this.history.get(key) ?? [];
        this.history.set(key, Object.freeze([...current, transition]));
    }
    resolve(releaseId) {
        return this.history.get(ensure(releaseId, "releaseId")) ?? [];
    }
}
export class StateVersionManager {
    versions;
    constructor(versions) {
        this.versions = versions;
    }
    next(releaseId) {
        const key = ensure(releaseId, "releaseId");
        const current = this.versions.get(key) ?? 0;
        const next = current + 1;
        this.versions.set(key, next);
        return next;
    }
    current(releaseId) {
        return this.versions.get(ensure(releaseId, "releaseId")) ?? 1;
    }
}
export class StatusEvidenceCollector {
    collect(input) {
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
    merge(current, incoming) {
        if (incoming.normalizedAt >= current.normalizedAt) {
            return incoming;
        }
        return current;
    }
}
export class ConsensusResolver {
    mergeStrategy;
    constructor(mergeStrategy) {
        this.mergeStrategy = mergeStrategy;
    }
    resolve(current, candidates) {
        return candidates.reduce((best, candidate) => this.mergeStrategy.merge(best, candidate), current);
    }
}
export class StateReconciliationEngine {
    validator;
    conflictResolver;
    consensusResolver;
    constructor(validator, conflictResolver, consensusResolver) {
        this.validator = validator;
        this.conflictResolver = conflictResolver;
        this.consensusResolver = consensusResolver;
    }
    reconcile(snapshot, evidences) {
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
    validator;
    constructor(validator) {
        this.validator = validator;
    }
    plan(snapshot, incoming) {
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
    next(current) {
        return current ? current.version + 1 : 1;
    }
}
export class SnapshotSerializer {
    serialize(snapshot) {
        return serializeCanonicalJSON(snapshot);
    }
    deserialize(serialized) {
        const value = JSON.parse(serialized);
        return value;
    }
}
export class SnapshotStore {
    snapshots;
    constructor(snapshots) {
        this.snapshots = snapshots;
    }
    save(snapshot) {
        this.snapshots.set(snapshot.releaseId, snapshot);
    }
    load(releaseId) {
        return this.snapshots.get(ensure(releaseId, "releaseId")) ?? null;
    }
}
export class SnapshotGenerator {
    versioning;
    constructor(versioning) {
        this.versioning = versioning;
    }
    generate(input) {
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
    store;
    serializer;
    constructor(store, serializer) {
        this.store = store;
        this.serializer = serializer;
    }
    recover(releaseId) {
        const snapshot = this.store.load(releaseId);
        return snapshot ? this.serializer.deserialize(this.serializer.serialize(snapshot)) : null;
    }
}
export class StateSnapshotManagerBridge {
    store;
    generator;
    constructor(store, generator) {
        this.store = store;
        this.generator = generator;
    }
    capture(input) {
        const snapshot = this.generator.generate(input);
        this.store.save(snapshot);
        return snapshot;
    }
}
export class TimelineBuilder {
    build(events) {
        return new StatusTimeline({
            releaseId: events[0]?.releaseId ?? "unknown",
            events,
            metadata: freezeRecord({ eventCount: events.length }),
        });
    }
}
export class TimelinePublisher {
    published;
    constructor(published) {
        this.published = published;
    }
    publish(timeline) {
        this.published.set(timeline.releaseId, timeline);
    }
    resolve(releaseId) {
        return this.published.get(ensure(releaseId, "releaseId")) ?? null;
    }
}
export class TimelineProjector {
    build(timeline) {
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
    records = [];
    record(timeline) {
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
    planner;
    mapper;
    constructor(planner, mapper) {
        this.planner = planner;
        this.mapper = mapper;
    }
    replay(snapshot, events) {
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
    replayEngine;
    constructor(replayEngine) {
        this.replayEngine = replayEngine;
    }
    replay(snapshot, events) {
        return this.replayEngine.replay(snapshot, events);
    }
}
export class StateRecovery {
    snapshotRecovery;
    replayEngine;
    constructor(snapshotRecovery, replayEngine) {
        this.snapshotRecovery = snapshotRecovery;
        this.replayEngine = replayEngine;
    }
    recover(releaseId, events = []) {
        const snapshot = this.snapshotRecovery.recover(releaseId);
        return snapshot ? this.replayEngine.replay(snapshot, events) : null;
    }
}
export class CheckpointRecovery {
    store;
    constructor(store) {
        this.store = store;
    }
    recover(releaseId) {
        return this.store.load(releaseId);
    }
}
export class RollbackPlanner {
    plan(snapshot) {
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
    distribution;
    release;
    dashboard;
    analytics;
    checkpoints;
    constructor(distribution, release, dashboard, analytics, checkpoints) {
        this.distribution = distribution;
        this.release = release;
        this.dashboard = dashboard;
        this.analytics = analytics;
        this.checkpoints = checkpoints;
    }
    publish(result) {
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
    publisher;
    constructor(publisher) {
        this.publisher = publisher;
    }
    project(result) {
        this.publisher.publish(result);
    }
}
export class AnalyticsProjection {
    publisher;
    constructor(publisher) {
        this.publisher = publisher;
    }
    project(result) {
        this.publisher.publish(result);
    }
}
export class ReleaseProjection {
    publisher;
    constructor(publisher) {
        this.publisher = publisher;
    }
    project(result) {
        this.publisher.publish(result);
    }
}
export class StateCoordinator {
    runtime;
    constructor(runtime) {
        this.runtime = runtime;
    }
    coordinate(input) {
        return this.runtime.synchronize(input);
    }
}
export class StateResolver {
    registry;
    constructor(registry) {
        this.registry = registry;
    }
    resolve(key) {
        if (key) {
            return this.registry.resolve(key) ?? this.registry.resolve("*");
        }
        return this.registry.resolve("*");
    }
}
export class StateSyncRuntimeEngine extends TrackSyraStatusSyncRuntimeEngine {
    constructor(dependencies) {
        super(dependencies);
    }
}
export class IncrementalSync {
    coordinator;
    constructor(coordinator) {
        this.coordinator = coordinator;
    }
    sync(input) {
        return this.coordinator.coordinate(input);
    }
}
export class FullSync extends IncrementalSync {
}
export class ScheduledSync extends IncrementalSync {
}
export class ManualSync extends IncrementalSync {
}
export class RetrySync extends IncrementalSync {
}
export class BackgroundSync extends IncrementalSync {
}
export class StateSyncLogger extends TrackSyraStatusLogger {
}
export class StateSyncMetrics extends TrackSyraStatusMetrics {
}
export class StateSyncHealthChecker {
    healthy() {
        return true;
    }
}
