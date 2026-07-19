export class OrchestratorStage {
    stageId;
    name;
    dependencies;
    retryable;
    checkpointable;
    createdAt;
    metadata;
    constructor(input) {
        this.stageId = input.stageId.trim();
        this.name = input.name;
        this.dependencies = Object.freeze([...(input.dependencies ?? [])]);
        this.retryable = input.retryable ?? true;
        this.checkpointable = input.checkpointable ?? true;
        this.createdAt = input.createdAt ?? new Date().toISOString();
        this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
        if (!this.stageId) {
            throw new Error("OrchestratorStage.stageId must not be empty");
        }
        Object.freeze(this);
    }
}
