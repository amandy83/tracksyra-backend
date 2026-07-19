export class WorkflowPipelineGraph {
    pipelineId;
    stageOrder;
    transitionOrder;
    createdAt;
    metadata;
    constructor(input) {
        this.pipelineId = input.pipelineId.trim();
        this.stageOrder = Object.freeze([...(input.stageOrder ?? [])]);
        this.transitionOrder = Object.freeze([...(input.transitionOrder ?? [])]);
        this.createdAt = input.createdAt ?? new Date().toISOString();
        this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
        if (!this.pipelineId) {
            throw new Error("WorkflowPipelineGraph.pipelineId must not be empty");
        }
        Object.freeze(this);
    }
}
