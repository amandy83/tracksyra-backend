import type { ProviderIntegration } from "../contracts/providerIntegrationContracts";
import type { ProviderSession, ProviderCredentials } from "../types/providerIntegrationTypes";

export interface ProviderAuthenticationGateway {
  authenticate(integration: ProviderIntegration): Promise<ProviderSession> | ProviderSession;
  refresh(integration: ProviderIntegration): Promise<ProviderCredentials> | ProviderCredentials;
}
