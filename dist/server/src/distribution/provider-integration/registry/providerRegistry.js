export class ProviderIntegrationRegistryEntry {
    providerName;
    adapterName;
    integration;
    registeredAt;
    constructor(input) {
        this.providerName = input.providerName.trim();
        this.adapterName = input.adapterName.trim();
        this.integration = input.integration;
        this.registeredAt = input.registeredAt ?? new Date().toISOString();
        if (!this.providerName || !this.adapterName) {
            throw new Error("ProviderIntegrationRegistryEntry requires non-empty identifiers");
        }
        Object.freeze(this);
    }
}
