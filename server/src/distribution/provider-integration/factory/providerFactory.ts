import type { ProviderConfiguration } from "../types/providerIntegrationTypes";
import type { ProviderIntegration } from "../contracts/providerIntegrationContracts";

export interface ProviderIntegrationFactory {
  create(configuration: ProviderConfiguration): ProviderIntegration;
}
