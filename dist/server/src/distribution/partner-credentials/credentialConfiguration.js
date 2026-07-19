function ensure(value, field) {
    const trimmed = value.trim();
    if (!trimmed) {
        throw new Error(`${field} must not be empty`);
    }
    return trimmed;
}
export class CredentialConfiguration {
    environment;
    encryptionSecret;
    defaultVersion;
    rotationEnabled;
    backupEnabled;
    metadata;
    constructor(input = {}) {
        this.environment = input.environment ?? "production";
        this.encryptionSecret = input.encryptionSecret ?? null;
        this.defaultVersion = ensure(input.defaultVersion ?? "1.0.0", "defaultVersion");
        this.rotationEnabled = input.rotationEnabled ?? true;
        this.backupEnabled = input.backupEnabled ?? true;
        this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
        Object.freeze(this);
    }
}
