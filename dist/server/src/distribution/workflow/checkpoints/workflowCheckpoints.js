export class WorkflowCheckpointStore {
    storeId;
    workflowId;
    releaseId;
    stage;
    createdAt;
    metadata;
    constructor(input) {
        this.storeId = input.storeId.trim();
        this.workflowId = input.workflowId.trim();
        this.releaseId = input.releaseId.trim();
        this.stage = input.stage;
        this.createdAt = input.createdAt ?? new Date().toISOString();
        this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
        if (!this.storeId || !this.workflowId || !this.releaseId) {
            throw new Error("WorkflowCheckpointStore requires non-empty identifiers");
        }
        Object.freeze(this);
    }
}
