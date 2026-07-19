export class WebhookEvent {
    webhookId;
    providerStatusEvent;
    receivedAt;
    signatureValidatedAt;
    validationPassed;
    metadata;
    constructor(input) {
        this.webhookId = input.webhookId.trim();
        this.providerStatusEvent = input.providerStatusEvent;
        this.receivedAt = input.receivedAt ?? new Date().toISOString();
        this.signatureValidatedAt = input.signatureValidatedAt ?? null;
        this.validationPassed = input.validationPassed ?? false;
        this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
        if (!this.webhookId) {
            throw new Error("WebhookEvent.webhookId must not be empty");
        }
        Object.freeze(this);
    }
}
