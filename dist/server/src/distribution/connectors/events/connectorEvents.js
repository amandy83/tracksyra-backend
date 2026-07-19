export class ConnectorEvent {
    type;
    connectorId;
    releaseId;
    occurredAt;
    payload;
    constructor(input) {
        this.type = input.type;
        this.connectorId = input.connectorId.trim();
        this.releaseId = input.releaseId ?? null;
        this.occurredAt = input.occurredAt ?? new Date().toISOString();
        this.payload = Object.freeze({ ...(input.payload ?? {}) });
        if (!this.connectorId) {
            throw new Error("ConnectorEvent.connectorId must not be empty");
        }
        Object.freeze(this);
    }
}
