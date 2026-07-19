export class ConnectorTakedown {
    takedownId;
    connectorId;
    releaseId;
    requestedAt;
    completedAt;
    metadata;
    constructor(input) {
        this.takedownId = input.takedownId.trim();
        this.connectorId = input.connectorId.trim();
        this.releaseId = input.releaseId.trim();
        this.requestedAt = input.requestedAt ?? new Date().toISOString();
        this.completedAt = input.completedAt ?? null;
        this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
        if (!this.takedownId || !this.connectorId || !this.releaseId) {
            throw new Error("ConnectorTakedown requires non-empty identifiers");
        }
        Object.freeze(this);
    }
}
