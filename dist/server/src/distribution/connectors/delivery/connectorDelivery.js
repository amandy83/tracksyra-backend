export class ConnectorDelivery {
    deliveryId;
    connectorId;
    releaseId;
    assets;
    submittedAt;
    metadata;
    constructor(input) {
        this.deliveryId = input.deliveryId.trim();
        this.connectorId = input.connectorId.trim();
        this.releaseId = input.releaseId.trim();
        this.assets = Object.freeze([...(input.assets ?? [])]);
        this.submittedAt = input.submittedAt ?? new Date().toISOString();
        this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
        if (!this.deliveryId || !this.connectorId || !this.releaseId) {
            throw new Error("ConnectorDelivery requires non-empty identifiers");
        }
        Object.freeze(this);
    }
}
