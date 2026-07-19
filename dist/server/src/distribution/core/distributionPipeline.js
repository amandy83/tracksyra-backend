import { DistributionError } from "./distributionError.js";
import { DistributionStatus } from "./distributionStatus.js";
import { createDistributionResult } from "./distributionResult.js";
export class DistributionPipeline {
    deps;
    logger;
    retryPolicy;
    now;
    constructor(deps) {
        this.deps = deps;
        this.logger = deps.logger;
        this.retryPolicy = deps.retryPolicy;
        this.now = deps.now;
    }
    async execute(job, context) {
        const startedAt = this.now();
        this.logger.info("[distribution] job started", { jobId: job.id, provider: job.provider, releaseId: job.releaseId, trackId: job.trackId });
        this.deps.events?.emit("job:started", { job, context });
        try {
            const provider = this.resolveProvider(context);
            this.deps.events?.emit("provider:resolved", { job, context, provider: provider.name });
            const builtPackage = await this.deps.packageBuilder.build(context);
            this.deps.events?.emit("package:built", { job, context, package: builtPackage });
            const submission = await provider.submit(builtPackage, context);
            const completedAt = this.now();
            const nextRetryAt = this.computeRetryAt(submission.status, job, context, submission.metadata ?? {});
            const result = createDistributionResult({
                jobId: job.id,
                provider: provider.name,
                status: submission.status,
                attempts: job.attempt,
                providerReferenceId: submission.providerReferenceId ?? null,
                manifestId: builtPackage.manifest.id,
                checksum: builtPackage.checksum,
                nextRetryAt,
                completedAt,
                metadata: submission.metadata ?? {},
                rawResponse: submission.rawResponse,
            });
            if (submission.status === DistributionStatus.FAILED) {
                const error = new DistributionError({
                    code: "PROVIDER_FAILURE",
                    message: "Distribution provider reported a failure",
                    provider: provider.name,
                    status: submission.status,
                    retryable: Boolean(nextRetryAt),
                    metadata: { jobId: job.id, startedAt: startedAt.toISOString(), completedAt: completedAt.toISOString() },
                });
                this.logger.warn("[distribution] job failed", { jobId: job.id, provider: provider.name, retryAt: nextRetryAt?.toISOString() ?? null });
                this.deps.events?.emit("job:failed", { job, context, error, result });
                if (nextRetryAt)
                    this.deps.events?.emit("retry:scheduled", { job, context, error, retryAt: nextRetryAt, attempt: job.attempt + 1 });
            }
            else {
                this.logger.info("[distribution] job completed", { jobId: job.id, provider: provider.name, status: submission.status });
                this.deps.events?.emit("job:completed", { job, context, result });
            }
            return result;
        }
        catch (error) {
            const normalized = DistributionError.fromUnknown(error, {
                code: "UNEXPECTED_ERROR",
                provider: context.provider,
                status: DistributionStatus.FAILED,
                retryable: true,
            });
            const completedAt = this.now();
            const retryDecision = this.retryPolicy.decide(normalized, job.attempt);
            const nextRetryAt = retryDecision.action === "RETRY" ? retryDecision.retryAt : null;
            const result = createDistributionResult({
                jobId: job.id,
                provider: context.provider,
                status: DistributionStatus.FAILED,
                attempts: job.attempt,
                manifestId: context.manifest?.id ?? null,
                checksum: context.manifest?.checksum ?? null,
                nextRetryAt,
                completedAt,
                metadata: { errorCode: normalized.code, provider: normalized.provider, ...normalized.metadata },
                errors: [normalized],
                rawResponse: undefined,
            });
            this.logger.error("[distribution] job crashed", { jobId: job.id, provider: context.provider, errorCode: normalized.code });
            this.deps.events?.emit("job:failed", { job, context, error: normalized, result });
            if (nextRetryAt)
                this.deps.events?.emit("retry:scheduled", { job, context, error: normalized, retryAt: nextRetryAt, attempt: job.attempt + 1 });
            return result;
        }
    }
    resolveProvider(context) {
        return this.deps.providerResolver.resolve(context, context.provider);
    }
    computeRetryAt(status, job, context, metadata) {
        if (status !== DistributionStatus.FAILED)
            return null;
        const decision = this.retryPolicy.decide(new DistributionError({
            code: "PROVIDER_FAILURE",
            message: "Provider failed during submission",
            provider: context.provider,
            status,
            retryable: true,
            metadata,
        }), job.attempt);
        return decision.action === "RETRY" ? decision.retryAt : null;
    }
}
