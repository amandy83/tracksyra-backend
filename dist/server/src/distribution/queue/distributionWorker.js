import { UnsupportedPlatformError, } from "../adapters/platformAdapterRegistry.js";
import { DistributionStatus, } from "../intelligence/index.js";
import { createWorker } from "../../queue/queueFactory.js";
import { queueNames } from "../../queue/queueNames.js";
import { captureException } from "../../observability/errorTracker.js";
const TOO_LOST_PROVIDER = "too_lost";
export function registerDistributionQueueWorker(worker, options = {}) {
    return createWorker(queueNames.distribution, async (job) => {
        const data = job.data;
        await worker.process(data.distributionJob);
    }, { concurrency: options.concurrency });
}
export class DistributionWorker {
    store;
    adapterRegistry;
    retryEngine;
    intelligenceStore;
    analyticsService;
    constructor(store, options) {
        this.store = store;
        this.adapterRegistry = options.adapterRegistry;
        this.retryEngine = options.retryEngine;
        this.intelligenceStore = options.intelligenceStore;
        this.analyticsService = options.analyticsService;
    }
    async process(job) {
        if (!job.releaseId || !job.trackId)
            throw new Error("Distribution job requires releaseId and trackId");
        try {
            const payload = await this.store.getJobPayload(job);
            if (!payload)
                throw new Error(`Distribution payload not found for job ${job.id}`);
            const adapter = this.adapterRegistry.get(job.platform);
            const providerPlatform = adapter.name;
            await this.store.ensurePlatformDelivery({
                releaseId: job.releaseId,
                trackId: job.trackId,
                userId: payload.track.userId,
                platform: providerPlatform,
            });
            await this.store.updateJobStatus(job.id, "PROCESSING");
            await this.appendHistory(job, DistributionStatus.PROCESSING, "WORKER");
            await this.store.updateDeliveryStatus({
                releaseId: job.releaseId,
                trackId: job.trackId,
                platform: providerPlatform,
                status: "PROCESSING",
            });
            await adapter.authenticate();
            const result = await adapter.uploadTrack(payload);
            if (await this.store.isWebhookConfirmed({ releaseId: job.releaseId, trackId: job.trackId, platform: providerPlatform })) {
                await this.appendHistory(job, DistributionStatus.SUBMITTED, "WORKER", { skippedOverwrite: true });
                return;
            }
            await this.store.recordDeliveryResult({
                releaseId: job.releaseId,
                trackId: job.trackId,
                platform: providerPlatform,
                status: result.status,
                platformTrackId: result.platformTrackId,
                rawResponse: result.rawResponse,
            });
            await this.store.updateJobStatus(job.id, result.status);
            await this.appendHistory(job, result.status === "PUBLISHED" ? DistributionStatus.SUBMITTED : DistributionStatus.FAILED, "WORKER", {
                platformTrackId: result.platformTrackId,
            });
            await this.analyticsService.refreshPlatformMetrics(providerPlatform);
        }
        catch (error) {
            await captureException({
                error,
                context: {
                    component: "distribution-worker",
                    jobId: job.id,
                    releaseId: job.releaseId,
                    trackId: job.trackId,
                    platform: job.platform,
                },
                tags: { worker: "distribution", platform: String(job.platform) },
            });
            const normalized = this.normalizeWorkerError(error, job.platform);
            const decision = this.retryEngine.decide(normalized, this.attemptNumber(job));
            await this.store.recordDeliveryResult({
                releaseId: job.releaseId,
                trackId: job.trackId,
                platform: TOO_LOST_PROVIDER,
                status: "FAILED",
                rawResponse: { error: normalized },
                error: normalized,
            });
            await this.applyRetryDecision(job, normalized, decision);
            await this.analyticsService.refreshPlatformMetrics(TOO_LOST_PROVIDER);
        }
    }
    async processPending(limit = 25) {
        const jobs = await this.store.getPendingJobs(limit);
        for (const job of jobs) {
            await this.process(job);
        }
        return jobs.length;
    }
    normalizeWorkerError(error, platform) {
        if (this.isNormalizedError(error))
            return error;
        if (error instanceof UnsupportedPlatformError) {
            return {
                errorCode: error.errorCode,
                message: error.message,
                platform,
                provider: TOO_LOST_PROVIDER,
                retryable: error.retryable,
            };
        }
        return {
            errorCode: "DISTRIBUTION_WORKER_ERROR",
            message: error instanceof Error ? error.message : String(error),
            platform,
            provider: TOO_LOST_PROVIDER,
            retryable: true,
        };
    }
    isNormalizedError(error) {
        return Boolean(error &&
            typeof error === "object" &&
            "errorCode" in error &&
            "message" in error &&
            "platform" in error &&
            "retryable" in error);
    }
    attemptNumber(job) {
        return typeof job.attempts === "number" ? job.attempts : 0;
    }
    async applyRetryDecision(job, error, decision) {
        if (!job.releaseId || !job.trackId)
            return;
        if (decision.action === "RETRY") {
            await this.intelligenceStore.scheduleRetry({
                jobId: job.id,
                releaseId: job.releaseId,
                trackId: job.trackId,
                platform: TOO_LOST_PROVIDER,
                attempt: this.attemptNumber(job) + 1,
                retryAt: decision.retryAt,
                error,
            });
            await this.appendHistory(job, DistributionStatus.FAILED, "RETRY", { retryAt: decision.retryAt.toISOString(), error });
            return;
        }
        if (decision.action === "DEAD_LETTER") {
            await this.intelligenceStore.markDeadLetter({
                jobId: job.id,
                releaseId: job.releaseId,
                trackId: job.trackId,
                platform: TOO_LOST_PROVIDER,
                attempt: this.attemptNumber(job) + 1,
                error,
            });
            await this.appendHistory(job, DistributionStatus.DEAD_LETTER, "RETRY", { error });
            return;
        }
        await this.store.updateJobStatus(job.id, "FAILED");
        await this.appendHistory(job, DistributionStatus.FAILED, "WORKER", { error });
    }
    async appendHistory(job, nextStatus, source, metadata) {
        if (!job.releaseId)
            return;
        await this.intelligenceStore.appendStateHistory({
            jobId: job.id,
            releaseId: job.releaseId,
            trackId: job.trackId ?? null,
            platform: TOO_LOST_PROVIDER,
            nextStatus,
            source,
            metadata,
        });
    }
}
