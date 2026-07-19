export class ConnectorHealth {
    connectorId;
    healthy;
    latencyMs;
    checkedAt;
    details;
    constructor(input) {
        this.connectorId = input.connectorId.trim();
        this.healthy = input.healthy;
        this.latencyMs = input.latencyMs ?? null;
        this.checkedAt = input.checkedAt ?? new Date().toISOString();
        this.details = Object.freeze({ ...(input.details ?? {}) });
        if (!this.connectorId) {
            throw new Error("ConnectorHealth.connectorId must not be empty");
        }
        Object.freeze(this);
    }
}
