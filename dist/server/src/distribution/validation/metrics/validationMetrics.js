function ensure(value, field) {
    const trimmed = value.trim();
    if (!trimmed) {
        throw new Error(`${field} must not be empty`);
    }
    return trimmed;
}
function freezeMetadata(metadata) {
    return Object.freeze({ ...metadata });
}
export class ValidationMetric {
    metricId;
    name;
    scope;
    value;
    recordedAt;
    metadata;
    constructor(input) {
        this.metricId = ensure(input.metricId, "metricId");
        this.name = ensure(input.name, "name");
        this.scope = input.scope;
        this.value = input.value;
        this.recordedAt = input.recordedAt ?? new Date().toISOString();
        this.metadata = freezeMetadata((input.metadata ?? {}));
        if (!Number.isFinite(this.value)) {
            throw new Error("ValidationMetric.value must be finite");
        }
        Object.freeze(this);
    }
}
export class ValidationMetrics {
    metrics = [];
    record(metric) {
        this.metrics.push(metric);
    }
    create(name, scope, value, metadata = {}) {
        return new ValidationMetric({
            metricId: `validation-metric:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 8)}`,
            name,
            scope,
            value,
            metadata,
        });
    }
    list() {
        return Object.freeze([...this.metrics]);
    }
}
