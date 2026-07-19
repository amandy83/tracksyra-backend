export class QueueJob {
    jobId;
    executionId;
    releaseId;
    stage;
    priority;
    payload;
    metadata;
    retryCount;
    createdAt;
    scheduledAt;
    idempotencyKey;
    correlationId;
    jobType;
    constructor(input) {
        this.jobId = input.jobId.trim();
        this.executionId = input.executionId.trim();
        this.releaseId = input.releaseId.trim();
        this.stage = input.stage.trim();
        this.priority = input.priority;
        this.payload = input.payload;
        this.metadata = (input.metadata ?? {});
        this.retryCount = input.retryCount ?? 0;
        this.createdAt = input.createdAt ?? new Date().toISOString();
        this.scheduledAt = input.scheduledAt ?? null;
        this.idempotencyKey = input.idempotencyKey.trim();
        this.correlationId = input.correlationId.trim();
        this.jobType = input.jobType;
        if (!this.jobId || !this.executionId || !this.releaseId || !this.stage || !this.idempotencyKey || !this.correlationId) {
            throw new Error("QueueJob requires non-empty identifiers");
        }
        if (!Number.isInteger(this.retryCount) || this.retryCount < 0) {
            throw new Error("QueueJob.retryCount must be a non-negative integer");
        }
        Object.freeze(this);
    }
}
