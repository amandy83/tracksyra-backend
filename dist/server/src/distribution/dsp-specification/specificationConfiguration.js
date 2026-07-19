function ensure(value, field) {
    const trimmed = value.trim();
    if (!trimmed) {
        throw new Error(`${field} must not be empty`);
    }
    return trimmed;
}
export class SpecificationConfiguration {
    environment;
    defaultVersion;
    signingSecret;
    featureFlags;
    maxVersions;
    metadata;
    constructor(input = {}) {
        this.environment = input.environment ?? "production";
        this.defaultVersion = ensure(input.defaultVersion ?? "1.0.0", "defaultVersion");
        this.signingSecret = input.signingSecret ?? null;
        this.featureFlags = Object.freeze({ ...(input.featureFlags ?? {}) });
        this.maxVersions = Number.isFinite(input.maxVersions ?? 0) && (input.maxVersions ?? 0) > 0 ? Math.floor(input.maxVersions ?? 0) : 20;
        this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
        Object.freeze(this);
    }
}
