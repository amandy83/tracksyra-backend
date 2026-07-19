export class WorkerContext {
    workerId;
    workerType;
    executionId;
    releaseId;
    lifecycle;
    executionContext;
    lease;
    checkpoint;
    retryCount;
    metadata;
    createdAt;
    updatedAt;
    constructor(input) {
        this.workerId = input.workerId.trim();
        this.workerType = input.workerType.trim();
        this.executionId = input.executionId.trim();
        this.releaseId = input.releaseId.trim();
        this.lifecycle = input.lifecycle;
        this.executionContext = input.executionContext;
        this.lease = input.lease ?? null;
        this.checkpoint = input.checkpoint ?? null;
        this.retryCount = input.retryCount ?? 0;
        this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
        this.createdAt = input.createdAt ?? new Date().toISOString();
        this.updatedAt = input.updatedAt ?? this.createdAt;
        if (!this.workerId || !this.workerType || !this.executionId || !this.releaseId) {
            throw new Error("WorkerContext requires non-empty identifiers");
        }
        if (!Number.isInteger(this.retryCount) || this.retryCount < 0) {
            throw new Error("WorkerContext.retryCount must be a non-negative integer");
        }
        Object.freeze(this);
    }
    withLifecycle(lifecycle) {
        return new WorkerContext({
            workerId: this.workerId,
            workerType: this.workerType,
            executionId: this.executionId,
            releaseId: this.releaseId,
            lifecycle,
            executionContext: this.executionContext,
            lease: this.lease,
            checkpoint: this.checkpoint,
            retryCount: this.retryCount,
            metadata: this.metadata,
            createdAt: this.createdAt,
            updatedAt: new Date().toISOString(),
        });
    }
    withCheckpoint(checkpoint) {
        return new WorkerContext({
            workerId: this.workerId,
            workerType: this.workerType,
            executionId: this.executionId,
            releaseId: this.releaseId,
            lifecycle: this.lifecycle,
            executionContext: this.executionContext,
            lease: this.lease,
            checkpoint,
            retryCount: this.retryCount,
            metadata: this.metadata,
            createdAt: this.createdAt,
            updatedAt: new Date().toISOString(),
        });
    }
    withLease(lease) {
        return new WorkerContext({
            workerId: this.workerId,
            workerType: this.workerType,
            executionId: this.executionId,
            releaseId: this.releaseId,
            lifecycle: this.lifecycle,
            executionContext: this.executionContext,
            lease,
            checkpoint: this.checkpoint,
            retryCount: this.retryCount,
            metadata: this.metadata,
            createdAt: this.createdAt,
            updatedAt: new Date().toISOString(),
        });
    }
    withRetryCount(retryCount) {
        return new WorkerContext({
            workerId: this.workerId,
            workerType: this.workerType,
            executionId: this.executionId,
            releaseId: this.releaseId,
            lifecycle: this.lifecycle,
            executionContext: this.executionContext,
            lease: this.lease,
            checkpoint: this.checkpoint,
            retryCount,
            metadata: this.metadata,
            createdAt: this.createdAt,
            updatedAt: new Date().toISOString(),
        });
    }
}
