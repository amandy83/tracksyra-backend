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
export class ValidationConfiguration {
    validationId;
    strictMode;
    failFast;
    maxErrors;
    maxWarnings;
    enableMetrics;
    enableLogging;
    enableTracing;
    metadata;
    constructor(input) {
        this.validationId = ensure(input.validationId, "validationId");
        this.strictMode = input.strictMode ?? true;
        this.failFast = input.failFast ?? true;
        this.maxErrors = input.maxErrors ?? 0;
        this.maxWarnings = input.maxWarnings ?? 0;
        this.enableMetrics = input.enableMetrics ?? true;
        this.enableLogging = input.enableLogging ?? true;
        this.enableTracing = input.enableTracing ?? true;
        this.metadata = freezeMetadata((input.metadata ?? {}));
        if (!Number.isFinite(this.maxErrors) || this.maxErrors < 0) {
            throw new Error("ValidationConfiguration.maxErrors must be non-negative");
        }
        if (!Number.isFinite(this.maxWarnings) || this.maxWarnings < 0) {
            throw new Error("ValidationConfiguration.maxWarnings must be non-negative");
        }
        Object.freeze(this);
    }
}
