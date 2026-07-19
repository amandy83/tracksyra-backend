export class StatusTimeline {
    releaseId;
    events;
    createdAt;
    updatedAt;
    metadata;
    constructor(input) {
        this.releaseId = input.releaseId.trim();
        this.events = Object.freeze([...(input.events ?? [])]);
        this.createdAt = input.createdAt ?? new Date().toISOString();
        this.updatedAt = input.updatedAt ?? this.createdAt;
        this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
        if (!this.releaseId) {
            throw new Error("StatusTimeline.releaseId must not be empty");
        }
        Object.freeze(this);
    }
    append(event) {
        return new StatusTimeline({
            releaseId: this.releaseId,
            events: [...this.events, event],
            createdAt: this.createdAt,
            updatedAt: new Date().toISOString(),
            metadata: this.metadata,
        });
    }
}
