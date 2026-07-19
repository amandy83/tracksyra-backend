export class WorkflowStageGraph {
    graphId;
    stages;
    createdAt;
    metadata;
    constructor(input) {
        this.graphId = input.graphId.trim();
        this.stages = Object.freeze([...(input.stages ?? [])]);
        this.createdAt = input.createdAt ?? new Date().toISOString();
        this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
        if (!this.graphId) {
            throw new Error("WorkflowStageGraph.graphId must not be empty");
        }
        Object.freeze(this);
    }
}
