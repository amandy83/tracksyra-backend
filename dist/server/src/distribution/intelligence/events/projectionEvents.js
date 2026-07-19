export class ProjectionEvent {
    type;
    releaseId;
    occurredAt;
    payload;
    constructor(input) {
        this.type = input.type;
        this.releaseId = input.releaseId.trim();
        this.occurredAt = input.occurredAt ?? new Date().toISOString();
        this.payload = Object.freeze({ ...(input.payload ?? {}) });
        if (!this.releaseId) {
            throw new Error("ProjectionEvent.releaseId must not be empty");
        }
        Object.freeze(this);
    }
}
