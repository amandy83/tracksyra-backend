export class WorkflowArchiveFlow {
    archiveId;
    createdAt;
    location;
    metadata;
    constructor(input) {
        this.archiveId = input.archiveId.trim();
        this.createdAt = input.createdAt ?? new Date().toISOString();
        this.location = input.location?.trim() || null;
        this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
        if (!this.archiveId) {
            throw new Error("WorkflowArchiveFlow.archiveId must not be empty");
        }
        Object.freeze(this);
    }
}
