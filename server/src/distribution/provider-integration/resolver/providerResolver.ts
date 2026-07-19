import type { ProviderIntegration } from "../contracts/providerIntegrationContracts";

export interface ProviderIntegrationResolver {
  resolve(providerName: string): ProviderIntegration | null;
  resolveByAdapter(adapterName: string): ProviderIntegration | null;
}
