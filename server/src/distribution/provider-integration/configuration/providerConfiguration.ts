import type { ProviderConfiguration } from "../types/providerIntegrationTypes";

export interface ProviderIntegrationConfigurationProvider {
  load(providerName: string): Promise<ProviderConfiguration | null> | ProviderConfiguration | null;
  save(configuration: ProviderConfiguration): Promise<void> | void;
  list(): Promise<readonly ProviderConfiguration[]> | readonly ProviderConfiguration[];
}
