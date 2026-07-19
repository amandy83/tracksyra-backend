export class ConnectorWebhook {
    webhookId;
    connectorId;
    releaseId;
    eventType;
    receivedAt;
    headers;
    payload;
    signatureValid;
    constructor(input) {
        this.webhookId = input.webhookId.trim();
        this.connectorId = input.connectorId.trim();
        this.releaseId = input.releaseId.trim();
        this.eventType = input.eventType.trim();
        this.receivedAt = input.receivedAt ?? new Date().toISOString();
        this.headers = Object.freeze({ ...(input.headers ?? {}) });
        this.payload = Object.freeze({ ...(input.payload ?? {}) });
        this.signatureValid = input.signatureValid ?? false;
        if (!this.webhookId || !this.connectorId || !this.releaseId || !this.eventType) {
            throw new Error("ConnectorWebhook requires non-empty identifiers and eventType");
        }
        Object.freeze(this);
    }
}
