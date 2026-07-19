function freezeRecord(value) {
    return Object.freeze({ ...value });
}
function freezeStages(value) {
    return Object.freeze([...new Set(value)]);
}
export class DistributionExecutionContext {
    release;
    distributionJob;
    package;
    metadata;
    provider;
    executionId;
    checkpoint;
    stage;
    timestamps;
    retryCount;
    cancellationToken;
    executionMetadata;
    authentication;
    constructor(input) {
        this.release = input.release;
        this.distributionJob = input.distributionJob;
        this.package = input.package ?? null;
        this.metadata = freezeRecord(input.metadata ?? {});
        this.provider = input.provider ?? null;
        this.executionId = input.executionId.trim();
        if (!this.executionId) {
            throw new Error("executionId must not be empty");
        }
        this.checkpoint = input.checkpoint ?? null;
        this.stage = input.stage;
        const startedAt = input.timestamps?.startedAt ?? new Date().toISOString();
        const updatedAt = input.timestamps?.updatedAt ?? startedAt;
        this.timestamps = Object.freeze({
            startedAt,
            updatedAt,
            completedAt: input.timestamps?.completedAt ?? null,
        });
        this.retryCount = input.retryCount ?? 0;
        if (!Number.isInteger(this.retryCount) || this.retryCount < 0) {
            throw new Error("retryCount must be a non-negative integer");
        }
        this.cancellationToken = input.cancellationToken ?? {
            cancelled: false,
            reason: null,
            throwIfCancelled() {
                return;
            },
        };
        this.executionMetadata = freezeRecord(input.executionMetadata ?? {});
        this.authentication = input.authentication ?? null;
        Object.freeze(this);
    }
    withStage(stage) {
        return new DistributionExecutionContext({
            release: this.release,
            distributionJob: this.distributionJob,
            package: this.package,
            metadata: this.metadata,
            provider: this.provider,
            executionId: this.executionId,
            checkpoint: this.checkpoint,
            stage,
            timestamps: {
                ...this.timestamps,
                updatedAt: new Date().toISOString(),
            },
            retryCount: this.retryCount,
            cancellationToken: this.cancellationToken,
            executionMetadata: this.executionMetadata,
            authentication: this.authentication,
        });
    }
    withCheckpoint(checkpoint) {
        return new DistributionExecutionContext({
            release: this.release,
            distributionJob: this.distributionJob,
            package: this.package,
            metadata: this.metadata,
            provider: this.provider,
            executionId: this.executionId,
            checkpoint,
            stage: this.stage,
            timestamps: {
                ...this.timestamps,
                updatedAt: new Date().toISOString(),
            },
            retryCount: this.retryCount,
            cancellationToken: this.cancellationToken,
            executionMetadata: this.executionMetadata,
            authentication: this.authentication,
        });
    }
    withPackage(packageModel) {
        return new DistributionExecutionContext({
            release: this.release,
            distributionJob: this.distributionJob,
            package: packageModel,
            metadata: this.metadata,
            provider: this.provider,
            executionId: this.executionId,
            checkpoint: this.checkpoint,
            stage: this.stage,
            timestamps: this.timestamps,
            retryCount: this.retryCount,
            cancellationToken: this.cancellationToken,
            executionMetadata: this.executionMetadata,
            authentication: this.authentication,
        });
    }
    withProvider(provider) {
        return new DistributionExecutionContext({
            release: this.release,
            distributionJob: this.distributionJob,
            package: this.package,
            metadata: this.metadata,
            provider,
            executionId: this.executionId,
            checkpoint: this.checkpoint,
            stage: this.stage,
            timestamps: this.timestamps,
            retryCount: this.retryCount,
            cancellationToken: this.cancellationToken,
            executionMetadata: this.executionMetadata,
            authentication: this.authentication,
        });
    }
    withRetryCount(retryCount) {
        return new DistributionExecutionContext({
            release: this.release,
            distributionJob: this.distributionJob,
            package: this.package,
            metadata: this.metadata,
            provider: this.provider,
            executionId: this.executionId,
            checkpoint: this.checkpoint,
            stage: this.stage,
            timestamps: this.timestamps,
            retryCount,
            cancellationToken: this.cancellationToken,
            executionMetadata: this.executionMetadata,
            authentication: this.authentication,
        });
    }
    withExecutionMetadata(executionMetadata) {
        return new DistributionExecutionContext({
            release: this.release,
            distributionJob: this.distributionJob,
            package: this.package,
            metadata: this.metadata,
            provider: this.provider,
            executionId: this.executionId,
            checkpoint: this.checkpoint,
            stage: this.stage,
            timestamps: this.timestamps,
            retryCount: this.retryCount,
            cancellationToken: this.cancellationToken,
            executionMetadata,
            authentication: this.authentication,
        });
    }
    withCompletedStage(stage) {
        const completedStages = freezeStages([
            ...this.completedStages(),
            stage,
        ]);
        return this.withExecutionMetadata({
            ...this.executionMetadata,
            completedStages,
        });
    }
    completedStages() {
        const stages = this.executionMetadata.completedStages;
        return Array.isArray(stages) ? freezeStages(stages) : [];
    }
}
