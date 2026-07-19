export class WorkerPipeline {
    pipelineId;
    name;
    stages;
    createdAt;
    metadata;
    constructor(input) {
        this.pipelineId = input.pipelineId.trim();
        this.name = input.name;
        this.stages = Object.freeze([...(input.stages ?? [])]);
        this.createdAt = input.createdAt ?? new Date().toISOString();
        this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
        if (!this.pipelineId) {
            throw new Error("WorkerPipeline.pipelineId must not be empty");
        }
        Object.freeze(this);
    }
}
