import type { ProviderIntegration } from "../contracts/providerIntegrationContracts";

export class ProviderIntegrationRegistryEntry {
  readonly providerName: string;
  readonly adapterName: string;
  readonly integration: ProviderIntegration;
  readonly registeredAt: string;

  constructor(input: {
    providerName: string;
    adapterName: string;
    integration: ProviderIntegration;
    registeredAt?: string;
  }) {
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

export interface ProviderIntegrationRegistry {
  register(entry: ProviderIntegrationRegistryEntry): void;
  resolve(providerName: string): ProviderIntegration | null;
  get(providerName: string): ProviderIntegrationRegistryEntry | null;
  list(): readonly ProviderIntegrationRegistryEntry[];
}
