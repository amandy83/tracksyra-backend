export class TimelineEntry {
    releaseId;
    stage;
    label;
    occurredAt;
    metadata;
    constructor(input) {
        this.releaseId = input.releaseId.trim();
        this.stage = input.stage;
        this.label = input.label.trim();
        this.occurredAt = input.occurredAt ?? new Date().toISOString();
        this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
        if (!this.releaseId || !this.label) {
            throw new Error("TimelineEntry requires releaseId and label");
        }
        Object.freeze(this);
    }
}
