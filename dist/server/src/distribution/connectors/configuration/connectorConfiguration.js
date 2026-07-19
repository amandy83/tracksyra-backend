export class ConnectorConfiguration {
    connectorId;
    version;
    enabled;
    authenticationType;
    settings;
    constructor(input) {
        this.connectorId = input.connectorId.trim();
        this.version = input.version.trim();
        this.enabled = input.enabled ?? true;
        this.authenticationType = input.authenticationType;
        this.settings = Object.freeze({ ...(input.settings ?? {}) });
        if (!this.connectorId || !this.version) {
            throw new Error("ConnectorConfiguration requires connectorId and version");
        }
        Object.freeze(this);
    }
}
export class ConnectorCredentials {
    connectorId;
    authenticationType;
    token;
    clientId;
    clientSecret;
    refreshToken;
    expiresAt;
    metadata;
    constructor(input) {
        this.connectorId = input.connectorId.trim();
        this.authenticationType = input.authenticationType;
        this.token = input.token ?? null;
        this.clientId = input.clientId ?? null;
        this.clientSecret = input.clientSecret ?? null;
        this.refreshToken = input.refreshToken ?? null;
        this.expiresAt = input.expiresAt ?? null;
        this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
        if (!this.connectorId) {
            throw new Error("ConnectorCredentials.connectorId must not be empty");
        }
        Object.freeze(this);
    }
}
