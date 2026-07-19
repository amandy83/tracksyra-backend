export class LogEntry {
    logId;
    level;
    message;
    source;
    occurredAt;
    traceId;
    spanId;
    metadata;
    constructor(input) {
        this.logId = input.logId.trim();
        this.level = input.level;
        this.message = input.message.trim();
        this.source = input.source.trim();
        this.occurredAt = input.occurredAt ?? new Date().toISOString();
        this.traceId = input.traceId ?? null;
        this.spanId = input.spanId ?? null;
        this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
        if (!this.logId || !this.message || !this.source) {
            throw new Error("LogEntry requires logId, message, and source");
        }
        Object.freeze(this);
    }
}
