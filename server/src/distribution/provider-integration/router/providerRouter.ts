import type { ProviderIntegration } from "../contracts/providerIntegrationContracts";

export interface ProviderIntegrationRouter {
  route(providerName: string, adapterName?: string | null): ProviderIntegration | null;
}
