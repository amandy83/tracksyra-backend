function createCheckpointId(executionId, stage) {
    const safeExecutionId = executionId.replace(/[^A-Za-z0-9._-]/g, "_");
    return `${safeExecutionId}:${stage}:${new Date().toISOString()}`;
}
export class Checkpoint {
    checkpointId;
    executionId;
    stage;
    createdAt;
    completedStages;
    retryCount;
    data;
    constructor(input) {
        this.executionId = input.executionId.trim();
        if (!this.executionId) {
            throw new Error("executionId must not be empty");
        }
        this.stage = input.stage;
        this.createdAt = input.createdAt ?? new Date().toISOString();
        this.completedStages = Object.freeze([...(input.completedStages ?? [])]);
        this.retryCount = input.retryCount ?? 0;
        this.data = Object.freeze({ ...(input.data ?? {}) });
        this.checkpointId = input.checkpointId ?? createCheckpointId(this.executionId, this.stage);
        if (!Number.isInteger(this.retryCount) || this.retryCount < 0) {
            throw new Error("retryCount must be a non-negative integer");
        }
        Object.freeze(this);
    }
}
export class StageCheckpointStrategy {
    shouldCheckpoint(context) {
        return !context.cancellationToken.cancelled;
    }
}
export class CheckpointManager {
    store;
    strategy;
    constructor(store, strategy) {
        this.store = store;
        this.strategy = strategy;
    }
    shouldCheckpoint(context) {
        return this.strategy.shouldCheckpoint(context);
    }
    async create(context) {
        if (!this.shouldCheckpoint(context)) {
            return null;
        }
        const checkpoint = new Checkpoint({
            executionId: context.executionId,
            stage: context.stage,
            completedStages: context.completedStages(),
            retryCount: context.retryCount,
            data: {
                metadata: context.executionMetadata,
                provider: context.provider?.value ?? null,
                packageFingerprint: context.package?.fingerprint.value ?? null,
                releaseId: context.release.release.id.value,
                distributionJobId: context.distributionJob.id.value,
            },
        });
        await this.store.save(checkpoint);
        return checkpoint;
    }
    async loadLatest(executionId) {
        const items = await Promise.resolve(this.store.list(executionId));
        return items.at(-1) ?? null;
    }
}
export class CheckpointResolver {
    store;
    constructor(store) {
        this.store = store;
    }
    async resolve(executionId, checkpointId) {
        if (checkpointId) {
            return await Promise.resolve(this.store.load(executionId, checkpointId));
        }
        const items = await Promise.resolve(this.store.list(executionId));
        return items.at(-1) ?? null;
    }
}
