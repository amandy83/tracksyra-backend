export class OrchestratorExecution {
    orchestrationId;
    releaseId;
    executionContext;
    result;
    startedAt;
    completedAt;
    metadata;
    constructor(input) {
        this.orchestrationId = input.orchestrationId.trim();
        this.releaseId = input.releaseId.trim();
        this.executionContext = input.executionContext ?? null;
        this.result = input.result ?? null;
        this.startedAt = input.startedAt ?? new Date().toISOString();
        this.completedAt = input.completedAt ?? null;
        this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
        if (!this.orchestrationId || !this.releaseId) {
            throw new Error("OrchestratorExecution requires identifiers");
        }
        Object.freeze(this);
    }
}
