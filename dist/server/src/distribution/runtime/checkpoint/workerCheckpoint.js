export class WorkerCheckpoint {
    checkpointId;
    workerId;
    executionId;
    stage;
    createdAt;
    restoredAt;
    checksum;
    data;
    constructor(input) {
        this.checkpointId = input.checkpointId.trim();
        this.workerId = input.workerId.trim();
        this.executionId = input.executionId.trim();
        this.stage = input.stage.trim();
        this.createdAt = input.createdAt ?? new Date().toISOString();
        this.restoredAt = input.restoredAt ?? null;
        this.checksum = input.checksum ?? null;
        this.data = Object.freeze({ ...(input.data ?? {}) });
        if (!this.checkpointId || !this.workerId || !this.executionId || !this.stage) {
            throw new Error("WorkerCheckpoint requires non-empty identifiers");
        }
        Object.freeze(this);
    }
}
