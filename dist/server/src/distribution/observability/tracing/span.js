export class Span {
    spanId;
    traceId;
    parentSpanId;
    category;
    name;
    startedAt;
    endedAt;
    durationMs;
    metadata;
    constructor(input) {
        this.spanId = input.spanId.trim();
        this.traceId = input.traceId.trim();
        this.parentSpanId = input.parentSpanId ?? null;
        this.category = input.category;
        this.name = input.name.trim();
        this.startedAt = input.startedAt ?? new Date().toISOString();
        this.endedAt = input.endedAt ?? null;
        this.durationMs = input.durationMs ?? null;
        this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
        if (!this.spanId || !this.traceId || !this.name) {
            throw new Error("Span requires spanId, traceId, and name");
        }
        Object.freeze(this);
    }
}
