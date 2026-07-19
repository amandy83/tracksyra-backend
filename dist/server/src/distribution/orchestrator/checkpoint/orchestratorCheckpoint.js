export class OrchestratorCheckpoint {
    checkpointId;
    orchestrationId;
    releaseId;
    stage;
    executionStage;
    createdAt;
    retryCount;
    metadata;
    constructor(input) {
        this.checkpointId = input.checkpointId.trim();
        this.orchestrationId = input.orchestrationId.trim();
        this.releaseId = input.releaseId.trim();
        this.stage = input.stage.trim();
        this.executionStage = input.executionStage ?? null;
        this.createdAt = input.createdAt ?? new Date().toISOString();
        this.retryCount = input.retryCount ?? 0;
        this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
        if (!this.checkpointId || !this.orchestrationId || !this.releaseId || !this.stage) {
            throw new Error("OrchestratorCheckpoint requires identifiers");
        }
        Object.freeze(this);
    }
}
