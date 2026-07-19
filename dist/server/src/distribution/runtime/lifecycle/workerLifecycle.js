export class WorkerLifecycle {
    workerId;
    executionId;
    state;
    createdAt;
    updatedAt;
    completedAt;
    metadata;
    constructor(input) {
        this.workerId = input.workerId.trim();
        this.executionId = input.executionId.trim();
        this.state = input.state;
        this.createdAt = input.createdAt ?? new Date().toISOString();
        this.updatedAt = input.updatedAt ?? this.createdAt;
        this.completedAt = input.completedAt ?? null;
        this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
        if (!this.workerId || !this.executionId) {
            throw new Error("WorkerLifecycle requires non-empty identifiers");
        }
        Object.freeze(this);
    }
}
