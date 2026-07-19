export class ObservabilityEvent {
    type;
    source;
    subject;
    occurredAt;
    payload;
    constructor(input) {
        this.type = input.type;
        this.source = input.source.trim();
        this.subject = input.subject.trim();
        this.occurredAt = input.occurredAt ?? new Date().toISOString();
        this.payload = Object.freeze({ ...(input.payload ?? {}) });
        if (!this.source || !this.subject) {
            throw new Error("ObservabilityEvent requires source and subject");
        }
        Object.freeze(this);
    }
}
