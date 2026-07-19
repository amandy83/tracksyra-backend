export class Metric {
    metricId;
    name;
    category;
    value;
    unit;
    recordedAt;
    tags;
    metadata;
    constructor(input) {
        this.metricId = input.metricId.trim();
        this.name = input.name.trim();
        this.category = input.category;
        this.value = input.value;
        this.unit = input.unit ?? null;
        this.recordedAt = input.recordedAt ?? new Date().toISOString();
        this.tags = Object.freeze({ ...(input.tags ?? {}) });
        this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
        if (!this.metricId || !this.name) {
            throw new Error("Metric requires metricId and name");
        }
        if (!Number.isFinite(this.value)) {
            throw new Error("Metric.value must be finite");
        }
        Object.freeze(this);
    }
}
