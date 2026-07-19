import { DistributionError } from "./distributionError.js";
export class ProviderRegistry {
    providers = new Map();
    register(provider) {
        this.providers.set(provider.name, provider);
    }
    has(providerName) {
        return this.providers.has(providerName);
    }
    get(providerName) {
        const provider = this.providers.get(providerName);
        if (!provider) {
            throw new DistributionError({
                code: "PROVIDER_NOT_FOUND",
                message: `Provider not found: ${providerName}`,
                provider: providerName,
            });
        }
        return provider;
    }
    list() {
        return [...this.providers.values()];
    }
}
