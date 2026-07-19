export class ObservabilityConfiguration {
    environment;
    enabled;
    samplingRate;
    retentionPolicyId;
    metadata;
    constructor(input) {
        this.environment = input.environment.trim();
        this.enabled = input.enabled ?? true;
        this.samplingRate = input.samplingRate ?? 1;
        this.retentionPolicyId = input.retentionPolicyId ?? null;
        this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
        if (!this.environment) {
            throw new Error("ObservabilityConfiguration.environment must not be empty");
        }
        if (!Number.isFinite(this.samplingRate) || this.samplingRate < 0 || this.samplingRate > 1) {
            throw new Error("ObservabilityConfiguration.samplingRate must be between 0 and 1");
        }
        Object.freeze(this);
    }
}
