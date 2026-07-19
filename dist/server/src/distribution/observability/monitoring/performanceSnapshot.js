export class PerformanceSnapshot {
    snapshotId;
    releaseId;
    measuredAt;
    latencies;
    counts;
    metadata;
    constructor(input) {
        this.snapshotId = input.snapshotId.trim();
        this.releaseId = input.releaseId ?? null;
        this.measuredAt = input.measuredAt ?? new Date().toISOString();
        this.latencies = Object.freeze({ ...(input.latencies ?? {}) });
        this.counts = Object.freeze({ ...(input.counts ?? {}) });
        this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
        if (!this.snapshotId) {
            throw new Error("PerformanceSnapshot.snapshotId must not be empty");
        }
        Object.freeze(this);
    }
}
