export class ConnectorPolling {
    pollingId;
    connectorId;
    releaseId;
    requestedAt;
    completedAt;
    payload;
    constructor(input) {
        this.pollingId = input.pollingId.trim();
        this.connectorId = input.connectorId.trim();
        this.releaseId = input.releaseId.trim();
        this.requestedAt = input.requestedAt ?? new Date().toISOString();
        this.completedAt = input.completedAt ?? null;
        this.payload = Object.freeze({ ...(input.payload ?? {}) });
        if (!this.pollingId || !this.connectorId || !this.releaseId) {
            throw new Error("ConnectorPolling requires non-empty identifiers");
        }
        Object.freeze(this);
    }
}
