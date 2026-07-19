export class ProviderIntegrationEvent {
    type;
    providerName;
    adapterName;
    occurredAt;
    payload;
    constructor(input) {
        this.type = input.type;
        this.providerName = input.providerName.trim();
        this.adapterName = input.adapterName.trim();
        this.occurredAt = input.occurredAt ?? new Date().toISOString();
        this.payload = Object.freeze({ ...(input.payload ?? {}) });
        if (!this.providerName || !this.adapterName) {
            throw new Error("ProviderIntegrationEvent requires non-empty identifiers");
        }
        Object.freeze(this);
    }
}
