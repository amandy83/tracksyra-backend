import type { ProviderIntegration } from "../contracts/providerIntegrationContracts";
import type { ProviderHealthSnapshot } from "../types/providerIntegrationTypes";

export interface ProviderHealthManager {
  check(integration: ProviderIntegration): Promise<ProviderHealthSnapshot> | ProviderHealthSnapshot;
  snapshot(providerName: string): Promise<ProviderHealthSnapshot> | ProviderHealthSnapshot;
}
