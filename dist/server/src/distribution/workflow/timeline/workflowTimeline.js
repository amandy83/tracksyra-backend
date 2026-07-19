export class WorkflowTimelineFlow {
    timelineId;
    entries;
    updatedAt;
    metadata;
    constructor(input) {
        this.timelineId = input.timelineId.trim();
        this.entries = Object.freeze([...(input.entries ?? [])]);
        this.updatedAt = input.updatedAt ?? new Date().toISOString();
        this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
        if (!this.timelineId) {
            throw new Error("WorkflowTimelineFlow.timelineId must not be empty");
        }
        Object.freeze(this);
    }
}
