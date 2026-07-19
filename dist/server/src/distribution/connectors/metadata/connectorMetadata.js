export class ConnectorMetadata {
    connectorId;
    releaseId;
    payload;
    language;
    territories;
    createdAt;
    constructor(input) {
        this.connectorId = input.connectorId.trim();
        this.releaseId = input.releaseId.trim();
        this.payload = Object.freeze({ ...(input.payload ?? {}) });
        this.language = input.language ?? null;
        this.territories = Object.freeze([...(input.territories ?? [])]);
        this.createdAt = input.createdAt ?? new Date().toISOString();
        if (!this.connectorId || !this.releaseId) {
            throw new Error("ConnectorMetadata requires connectorId and releaseId");
        }
        Object.freeze(this);
    }
}
