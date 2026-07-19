export class WorkflowCompensationGraph {
    graphId;
    actions;
    createdAt;
    metadata;
    constructor(input) {
        this.graphId = input.graphId.trim();
        this.actions = Object.freeze([...(input.actions ?? [])]);
        this.createdAt = input.createdAt ?? new Date().toISOString();
        this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
        if (!this.graphId) {
            throw new Error("WorkflowCompensationGraph.graphId must not be empty");
        }
        Object.freeze(this);
    }
}
