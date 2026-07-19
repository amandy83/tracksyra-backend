export class QueueBatch {
    batchId;
    policy;
    jobs;
    metadata;
    createdAt;
    constructor(input) {
        this.batchId = input.batchId.trim();
        this.policy = input.policy;
        this.jobs = Object.freeze([...(input.jobs ?? [])]);
        this.metadata = (input.metadata ?? {});
        this.createdAt = input.createdAt ?? new Date().toISOString();
        if (!this.batchId) {
            throw new Error("QueueBatch.batchId must not be empty");
        }
        Object.freeze(this);
    }
}
