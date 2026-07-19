export class WorkflowProjectionFlow {
    projectionId;
    views;
    createdAt;
    metadata;
    constructor(input) {
        this.projectionId = input.projectionId.trim();
        this.views = Object.freeze([...(input.views ?? [])]);
        this.createdAt = input.createdAt ?? new Date().toISOString();
        this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
        if (!this.projectionId) {
            throw new Error("WorkflowProjectionFlow.projectionId must not be empty");
        }
        Object.freeze(this);
    }
}
