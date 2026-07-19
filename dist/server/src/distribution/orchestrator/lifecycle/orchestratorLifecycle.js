export class OrchestratorLifecycle {
    orchestrationId;
    releaseId;
    state;
    createdAt;
    updatedAt;
    completedAt;
    metadata;
    constructor(input) {
        this.orchestrationId = input.orchestrationId.trim();
        this.releaseId = input.releaseId.trim();
        this.state = input.state;
        this.createdAt = input.createdAt ?? new Date().toISOString();
        this.updatedAt = input.updatedAt ?? this.createdAt;
        this.completedAt = input.completedAt ?? null;
        this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
        if (!this.orchestrationId || !this.releaseId) {
            throw new Error("OrchestratorLifecycle requires identifiers");
        }
        Object.freeze(this);
    }
}
