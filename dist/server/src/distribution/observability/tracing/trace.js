export class Trace {
    traceId;
    rootSpanId;
    category;
    name;
    startedAt;
    endedAt;
    spans;
    metadata;
    constructor(input) {
        this.traceId = input.traceId.trim();
        this.category = input.category;
        this.name = input.name.trim();
        this.rootSpanId = input.rootSpanId ?? null;
        this.startedAt = input.startedAt ?? new Date().toISOString();
        this.endedAt = input.endedAt ?? null;
        this.spans = Object.freeze([...(input.spans ?? [])]);
        this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
        if (!this.traceId || !this.name) {
            throw new Error("Trace requires traceId and name");
        }
        Object.freeze(this);
    }
}
