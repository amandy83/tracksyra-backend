export class ConnectorStatus {
    connectorId;
    releaseId;
    status;
    providerStatus;
    observedAt;
    metadata;
    constructor(input) {
        this.connectorId = input.connectorId.trim();
        this.releaseId = input.releaseId.trim();
        this.status = input.status;
        this.providerStatus = input.providerStatus.trim();
        this.observedAt = input.observedAt ?? new Date().toISOString();
        this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
        if (!this.connectorId || !this.releaseId || !this.providerStatus) {
            throw new Error("ConnectorStatus requires connectorId, releaseId, and providerStatus");
        }
        Object.freeze(this);
    }
}
