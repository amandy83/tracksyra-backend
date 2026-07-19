export class QueueMessage {
    messageId;
    type;
    body;
    headers;
    attributes;
    timestamp;
    constructor(input) {
        this.messageId = input.messageId.trim();
        this.type = input.type.trim();
        this.body = input.body;
        this.headers = Object.freeze({ ...(input.headers ?? {}) });
        this.attributes = Object.freeze({ ...(input.attributes ?? {}) });
        this.timestamp = input.timestamp ?? new Date().toISOString();
        if (!this.messageId || !this.type) {
            throw new Error("QueueMessage requires non-empty messageId and type");
        }
        Object.freeze(this);
    }
}
export class QueueEnvelope {
    message;
    lease;
    retryPolicy;
    deliveryAttempt;
    tracing;
    constructor(input) {
        this.message = input.message;
        this.lease = input.lease ?? null;
        this.retryPolicy = input.retryPolicy ?? null;
        this.deliveryAttempt = input.deliveryAttempt ?? 0;
        this.tracing = Object.freeze({ ...input.tracing });
        if (!Number.isInteger(this.deliveryAttempt) || this.deliveryAttempt < 0) {
            throw new Error("QueueEnvelope.deliveryAttempt must be a non-negative integer");
        }
        Object.freeze(this);
    }
}
