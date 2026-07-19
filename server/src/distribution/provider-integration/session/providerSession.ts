import type { ProviderIntegration } from "../contracts/providerIntegrationContracts";
import type { ProviderSession } from "../types/providerIntegrationTypes";

export interface ProviderSessionGateway {
  start(integration: ProviderIntegration): Promise<ProviderSession> | ProviderSession;
  renew(session: ProviderSession): Promise<ProviderSession> | ProviderSession;
  end(session: ProviderSession): Promise<boolean> | boolean;
}
