export class DistributionExecutionResult {
    success;
    failure;
    completedStage;
    executionTime;
    nextStage;
    checkpoint;
    errors;
    warnings;
    constructor(input) {
        this.success = input.success;
        this.failure = input.failure;
        this.completedStage = input.completedStage ?? null;
        this.executionTime = input.executionTime;
        this.nextStage = input.nextStage ?? null;
        this.checkpoint = input.checkpoint ?? null;
        this.errors = Object.freeze([...(input.errors ?? [])]);
        this.warnings = Object.freeze([...(input.warnings ?? [])]);
        if (!this.success && !this.failure) {
            throw new Error("Execution result must be either success or failure");
        }
        if (this.success && this.failure) {
            throw new Error("Execution result cannot be both success and failure");
        }
        if (!Number.isFinite(this.executionTime) || this.executionTime < 0) {
            throw new Error("executionTime must be a non-negative finite number");
        }
        Object.freeze(this);
    }
    static succeeded(input) {
        return new DistributionExecutionResult({
            success: true,
            failure: false,
            ...input,
            errors: [],
        });
    }
    static failed(input) {
        return new DistributionExecutionResult({
            success: false,
            failure: true,
            ...input,
        });
    }
}
