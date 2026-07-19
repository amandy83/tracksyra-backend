import type { ProviderIntegration } from "../contracts/providerIntegrationContracts";
import type { ProviderSelectionResult } from "../types/providerIntegrationTypes";

export interface ProviderSelectionService {
  select(providerName: string): Promise<ProviderSelectionResult> | ProviderSelectionResult;
  resolve(integration: ProviderIntegration): Promise<ProviderSelectionResult> | ProviderSelectionResult;
}
