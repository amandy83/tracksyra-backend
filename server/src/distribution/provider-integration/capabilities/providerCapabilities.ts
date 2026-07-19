import type { ProviderIntegration } from "../contracts/providerIntegrationContracts";
import type { ProviderCapabilitySet } from "../types/providerIntegrationTypes";

export interface ProviderCapabilityRegistry {
  resolve(integration: ProviderIntegration): Promise<ProviderCapabilitySet> | ProviderCapabilitySet;
}
