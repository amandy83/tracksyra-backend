export class ConnectorAuthenticationResult {
    connectorId;
    authenticated;
    credentials;
    authenticatedAt;
    expiresAt;
    metadata;
    constructor(input) {
        this.connectorId = input.connectorId.trim();
        this.authenticated = input.authenticated;
        this.credentials = input.credentials;
        this.authenticatedAt = input.authenticatedAt ?? new Date().toISOString();
        this.expiresAt = input.expiresAt ?? null;
        this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
        if (!this.connectorId) {
            throw new Error("ConnectorAuthenticationResult.connectorId must not be empty");
        }
        Object.freeze(this);
    }
}
