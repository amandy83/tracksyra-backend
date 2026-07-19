export class MonitoringSnapshot {
    snapshotId;
    capturedAt;
    status;
    summary;
    metadata;
    constructor(input) {
        this.snapshotId = input.snapshotId.trim();
        this.capturedAt = input.capturedAt ?? new Date().toISOString();
        this.status = input.status.trim();
        this.summary = Object.freeze({ ...(input.summary ?? {}) });
        this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
        if (!this.snapshotId || !this.status) {
            throw new Error("MonitoringSnapshot requires snapshotId and status");
        }
        Object.freeze(this);
    }
}
