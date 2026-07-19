export class ConnectorRoyalty {
    connectorId;
    releaseId;
    features;
    reportPeriod;
    importedAt;
    metadata;
    constructor(input) {
        this.connectorId = input.connectorId.trim();
        this.releaseId = input.releaseId.trim();
        this.features = Object.freeze([...(input.features ?? [])]);
        this.reportPeriod = input.reportPeriod.trim();
        this.importedAt = input.importedAt ?? new Date().toISOString();
        this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
        if (!this.connectorId || !this.releaseId || !this.reportPeriod) {
            throw new Error("ConnectorRoyalty requires non-empty identifiers");
        }
        Object.freeze(this);
    }
}
