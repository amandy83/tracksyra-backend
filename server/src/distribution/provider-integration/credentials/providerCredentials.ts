import type { ProviderIntegration } from "../contracts/providerIntegrationContracts";
import type { ProviderCredentials } from "../types/providerIntegrationTypes";

export interface ProviderCredentialStore {
  issue(integration: ProviderIntegration): Promise<ProviderCredentials> | ProviderCredentials;
  rotate(credentials: ProviderCredentials): Promise<ProviderCredentials> | ProviderCredentials;
  revoke(credentials: ProviderCredentials): Promise<boolean> | boolean;
}
