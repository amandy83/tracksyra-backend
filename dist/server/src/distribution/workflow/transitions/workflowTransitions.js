export class WorkflowTransitionGraph {
    graphId;
    transitions;
    createdAt;
    metadata;
    constructor(input) {
        this.graphId = input.graphId.trim();
        this.transitions = Object.freeze([
            ...(input.transitions ?? []).map((transition) => Object.freeze({ ...transition })),
        ]);
        this.createdAt = input.createdAt ?? new Date().toISOString();
        this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
        if (!this.graphId) {
            throw new Error("WorkflowTransitionGraph.graphId must not be empty");
        }
        Object.freeze(this);
    }
}
