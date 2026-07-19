export class ConnectorContext {
    connectorId;
    connectorVersion;
    releaseId;
    executionId;
    providerReference;
    configuration;
    metadata;
    attributes;
    createdAt;
    constructor(input) {
        this.connectorId = input.connectorId.trim();
        this.connectorVersion = input.connectorVersion.trim();
        this.releaseId = input.releaseId.trim();
        this.executionId = input.executionId.trim();
        this.providerReference = input.providerReference ?? null;
        this.configuration = input.configuration;
        this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
        this.attributes = Object.freeze({ ...(input.attributes ?? {}) });
        this.createdAt = input.createdAt ?? new Date().toISOString();
        if (!this.connectorId || !this.connectorVersion || !this.releaseId || !this.executionId) {
            throw new Error("ConnectorContext requires non-empty identifiers");
        }
        Object.freeze(this);
    }
}
