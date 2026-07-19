import { createWorker } from "../../queue/queueFactory.js";
import { queueNames } from "../../queue/queueNames.js";
import { incrementMetric, recordRetry, setWorkerHealth } from "../../queue/metrics.js";
function toInput(job) {
    const data = job;
    return {
        releaseId: data.releaseId ?? "",
        trackId: data.trackId ?? null,
        assetId: data.assetId ?? null,
        sourceUrl: data.sourceUrl ?? null,
        release: data.release ?? null,
        track: data.track ?? null,
        sampleRateHz: "sampleRateHz" in data ? data.sampleRateHz ?? null : null,
        pcmBuffer: "pcmBuffer" in data ? data.pcmBuffer ?? null : null,
        metadata: data.metadata ?? {},
        actor: "worker",
        correlationId: data.correlationId ?? null,
    };
}
export class FingerprintWorker {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    async process(job) {
        const result = await this.deps.engine.generateFingerprint(toInput(job));
        await this.recordOutcome(job.releaseId, "FINGERPRINT_GENERATED", result.reviewActions.length ? "UPDATED" : "SUCCESS", { duplicates: result.duplicates.length, fraudSignals: result.fraudSignals.length });
        incrementMetric("tracksyra_fingerprint_worker_completed_total", { queue: queueNames.fingerprint });
        return result;
    }
    async recordOutcome(releaseId, action, status, metadata) {
        if (!this.deps.operations)
            return;
        await this.deps.operations.recordAuditEvent({
            aggregateType: "audio_fingerprint",
            aggregateId: releaseId,
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
}
export class DuplicateDetectionWorker {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    async process(job) {
        const result = await this.deps.engine.findDuplicates(toInput(job));
        incrementMetric("tracksyra_duplicate_worker_completed_total", { queue: queueNames.duplicate });
        return result;
    }
}
export class SimilarityWorker {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    async process(job) {
        const result = await this.deps.engine.findSimilarTracks(toInput(job));
        incrementMetric("tracksyra_similarity_worker_completed_total", { queue: queueNames.similarity });
        return result;
    }
}
export class FraudAudioWorker {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    async process(job) {
        const result = await this.deps.engine.detectFraud(toInput(job));
        incrementMetric("tracksyra_audio_fraud_worker_completed_total", { queue: queueNames.audioFraud });
        return result;
    }
}
export class FingerprintRetryWorker {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    async process(job) {
        recordRetry(queueNames.fingerprintRetry);
        const result = await this.deps.engine.retry({ ...toInput(job), attempt: job.attempt ?? 1, error: job.error ?? null });
        incrementMetric("tracksyra_fingerprint_retry_worker_completed_total", { queue: queueNames.fingerprintRetry });
        return result;
    }
}
export class FingerprintAuditWorker {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    async process(job) {
        const result = await this.deps.engine.generateDashboard({
            releaseId: job.releaseId ?? null,
            kind: job.reportKind ?? "fingerprint",
        });
        setWorkerHealth(queueNames.fingerprintAudit, "healthy");
        incrementMetric("tracksyra_fingerprint_audit_worker_completed_total", { queue: queueNames.fingerprintAudit });
        return result;
    }
}
export function registerFingerprintWorker(deps, options = {}) {
    return createWorker(queueNames.fingerprint, async (job) => {
        const data = job.data;
        return new FingerprintWorker(deps).process(data);
    }, { concurrency: options.concurrency });
}
export function registerDuplicateDetectionWorker(deps, options = {}) {
    return createWorker(queueNames.duplicate, async (job) => {
        const data = job.data;
        return new DuplicateDetectionWorker(deps).process(data);
    }, { concurrency: options.concurrency });
}
export function registerSimilarityWorker(deps, options = {}) {
    return createWorker(queueNames.similarity, async (job) => {
        const data = job.data;
        return new SimilarityWorker(deps).process(data);
    }, { concurrency: options.concurrency });
}
export function registerFraudAudioWorker(deps, options = {}) {
    return createWorker(queueNames.audioFraud, async (job) => {
        const data = job.data;
        return new FraudAudioWorker(deps).process(data);
    }, { concurrency: options.concurrency });
}
export function registerFingerprintRetryWorker(deps, options = {}) {
    return createWorker(queueNames.fingerprintRetry, async (job) => {
        const data = job.data;
        return new FingerprintRetryWorker(deps).process(data);
    }, { concurrency: options.concurrency });
}
export function registerFingerprintAuditWorker(deps, options = {}) {
    return createWorker(queueNames.fingerprintAudit, async (job) => {
        const data = job.data;
        return new FingerprintAuditWorker(deps).process(data);
    }, { concurrency: options.concurrency });
}
