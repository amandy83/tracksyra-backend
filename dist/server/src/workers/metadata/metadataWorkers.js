import { createWorker } from "../../queue/queueFactory.js";
import { queueNames } from "../../queue/queueNames.js";
import { incrementMetric, recordRetry, setWorkerHealth } from "../../queue/metrics.js";
function toInput(job) {
    const release = job.release;
    if (!release) {
        throw new Error("Metadata worker requires a release payload on the queue job.");
    }
    return {
        releaseId: job.releaseId ?? "",
        trackId: job.trackId ?? null,
        actor: job.actorUserId ?? "worker",
        correlationId: job.correlationId ?? null,
        metadata: job.metadata ?? {},
        release,
        track: "track" in job ? job.track ?? null : null,
    };
}
async function recordOutcome(deps, aggregateId, action, metadata) {
    if (!deps.operations)
        return;
    await deps.operations.recordAuditEvent({
        aggregateType: "metadata_intelligence",
        aggregateId,
        action,
        actor: "worker",
        reason: null,
        correlationId: null,
        oldValue: null,
        newValue: metadata,
        metadata,
        ipAddress: null,
    });
}
export class MetadataValidationWorker {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    async process(job) {
        const result = await this.deps.engine.validateMetadata(toInput(job));
        await recordOutcome(this.deps, job.releaseId, "METADATA_VALIDATED", {
            releaseId: job.releaseId,
            trackId: job.trackId ?? null,
            valid: result.valid,
            conflictCount: result.conflicts.length,
            repairCount: result.repairs.length,
        });
        incrementMetric("tracksyra_metadata_validation_worker_completed_total", { queue: queueNames.metadataValidation });
        return result;
    }
}
export class MetadataNormalizationWorker {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    async process(job) {
        const result = await this.deps.engine.normalizeMetadata(toInput(job));
        await recordOutcome(this.deps, job.releaseId, "METADATA_NORMALIZED", {
            releaseId: job.releaseId,
            trackId: job.trackId ?? null,
            overallReleaseScore: result.quality.overallReleaseScore,
        });
        incrementMetric("tracksyra_metadata_normalization_worker_completed_total", { queue: queueNames.metadataNormalization });
        return result;
    }
}
export class MetadataRepairWorker {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    async process(job) {
        const result = await this.deps.engine.repairMetadata(toInput(job));
        await recordOutcome(this.deps, job.releaseId, "METADATA_REPAIRED", {
            releaseId: result.release.id,
            trackId: result.track?.id ?? null,
            repairs: result.repairs.length,
        });
        incrementMetric("tracksyra_metadata_repair_worker_completed_total", { queue: queueNames.metadataRepair });
        return result;
    }
}
export class MetadataRecommendationWorker {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    async process(job) {
        const result = await this.deps.engine.recommendMetadata(toInput(job));
        await recordOutcome(this.deps, job.releaseId, "METADATA_RECOMMENDATIONS_GENERATED", {
            releaseId: job.releaseId,
            trackId: job.trackId ?? null,
            recommendationCount: result.length,
        });
        incrementMetric("tracksyra_metadata_recommendation_worker_completed_total", { queue: queueNames.metadataRecommendation });
        return result;
    }
}
export class MetadataAuditWorker {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    async process(job) {
        const result = await this.deps.engine.generateDashboard({
            releaseId: job.releaseId ?? "",
            trackId: job.trackId ?? null,
            actor: job.actorUserId ?? "worker",
            correlationId: job.correlationId ?? null,
            metadata: job.metadata ?? {},
            kind: job.reportKind ?? "metadata",
        });
        setWorkerHealth(queueNames.metadataAudit, "healthy");
        incrementMetric("tracksyra_metadata_audit_worker_completed_total", { queue: queueNames.metadataAudit });
        return result;
    }
}
export class MetadataRetryWorker {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    async process(job) {
        recordRetry(queueNames.metadataRetry);
        const result = await this.deps.engine.retry({
            ...toInput(job),
            attempt: job.attempt ?? 1,
            error: job.error ?? null,
        });
        await recordOutcome(this.deps, job.releaseId, "METADATA_RETRY_PROCESSED", {
            releaseId: job.releaseId,
            trackId: job.trackId ?? null,
            attempt: job.attempt ?? 1,
        });
        incrementMetric("tracksyra_metadata_retry_worker_completed_total", { queue: queueNames.metadataRetry });
        return result;
    }
}
export function registerMetadataValidationWorker(deps, options = {}) {
    return createWorker(queueNames.metadataValidation, async (job) => new MetadataValidationWorker(deps).process(job.data), { concurrency: options.concurrency });
}
export function registerMetadataNormalizationWorker(deps, options = {}) {
    return createWorker(queueNames.metadataNormalization, async (job) => new MetadataNormalizationWorker(deps).process(job.data), { concurrency: options.concurrency });
}
export function registerMetadataRepairWorker(deps, options = {}) {
    return createWorker(queueNames.metadataRepair, async (job) => new MetadataRepairWorker(deps).process(job.data), { concurrency: options.concurrency });
}
export function registerMetadataRecommendationWorker(deps, options = {}) {
    return createWorker(queueNames.metadataRecommendation, async (job) => new MetadataRecommendationWorker(deps).process(job.data), { concurrency: options.concurrency });
}
export function registerMetadataAuditWorker(deps, options = {}) {
    return createWorker(queueNames.metadataAudit, async (job) => new MetadataAuditWorker(deps).process(job.data), { concurrency: options.concurrency });
}
export function registerMetadataRetryWorker(deps, options = {}) {
    return createWorker(queueNames.metadataRetry, async (job) => new MetadataRetryWorker(deps).process(job.data), { concurrency: options.concurrency });
}
