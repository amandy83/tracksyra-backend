export class ProjectionCheckpoint {
    checkpointId;
    releaseId;
    version;
    createdAt;
    replayCursor;
    metadata;
    constructor(input) {
        this.checkpointId = input.checkpointId.trim();
        this.releaseId = input.releaseId.trim();
        this.version = input.version;
        this.createdAt = input.createdAt ?? new Date().toISOString();
        this.replayCursor = input.replayCursor ?? null;
        this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
        if (!this.checkpointId || !this.releaseId || !Number.isInteger(this.version) || this.version < 1) {
            throw new Error("ProjectionCheckpoint requires valid identifiers and version");
        }
        Object.freeze(this);
    }
}
