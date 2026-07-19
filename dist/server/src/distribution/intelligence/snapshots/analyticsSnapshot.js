export class AnalyticsSnapshot {
    releaseId;
    generatedAt;
    metrics;
    metadata;
    constructor(input) {
        this.releaseId = input.releaseId.trim();
        this.generatedAt = input.generatedAt ?? new Date().toISOString();
        this.metrics = Object.freeze({ ...input.metrics });
        this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
        if (!this.releaseId) {
            throw new Error("AnalyticsSnapshot.releaseId must not be empty");
        }
        Object.freeze(this);
    }
}
