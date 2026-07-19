export class ProjectionResult {
    releaseId;
    success;
    projection;
    timeline;
    analytics;
    checkpoint;
    audit;
    search;
    metadata;
    constructor(input) {
        this.releaseId = input.releaseId.trim();
        this.success = input.success;
        this.projection = input.projection ?? null;
        this.timeline = Object.freeze([...(input.timeline ?? [])]);
        this.analytics = input.analytics ?? null;
        this.checkpoint = input.checkpoint ?? null;
        this.audit = Object.freeze([...(input.audit ?? [])]);
        this.search = Object.freeze([...(input.search ?? [])]);
        this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
        if (!this.releaseId) {
            throw new Error("ProjectionResult.releaseId must not be empty");
        }
        Object.freeze(this);
    }
}
