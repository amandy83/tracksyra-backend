export class WorkerFailure {
    category;
    message;
    retryable;
    occurredAt;
    checkpointId;
    metadata;
    constructor(input) {
        this.category = input.category;
        this.message = input.message.trim();
        this.retryable = input.retryable;
        this.occurredAt = input.occurredAt ?? new Date().toISOString();
        this.checkpointId = input.checkpointId ?? null;
        this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
        Object.freeze(this);
    }
}
export class WorkerResult {
    success;
    lifecycle;
    completedAt;
    checkpointId;
    executionResult;
    failure;
    warnings;
    metadata;
    constructor(input) {
        this.success = input.success;
        this.lifecycle = input.lifecycle;
        this.completedAt = input.completedAt ?? new Date().toISOString();
        this.checkpointId = input.checkpointId ?? null;
        this.executionResult = input.executionResult ?? null;
        this.failure = input.failure ?? null;
        this.warnings = Object.freeze([...(input.warnings ?? [])]);
        this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
        Object.freeze(this);
    }
}
