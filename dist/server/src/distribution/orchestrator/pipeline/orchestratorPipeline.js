export class OrchestratorPipeline {
    pipelineId;
    name;
    stages;
    createdAt;
    metadata;
    constructor(input) {
        this.pipelineId = input.pipelineId.trim();
        this.name = input.name.trim();
        this.stages = Object.freeze([...(input.stages ?? [])]);
        this.createdAt = input.createdAt ?? new Date().toISOString();
        this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
        if (!this.pipelineId || !this.name) {
            throw new Error("OrchestratorPipeline requires pipelineId and name");
        }
        Object.freeze(this);
    }
}
