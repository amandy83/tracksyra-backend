import type { ProviderRetryContext } from "../types/providerIntegrationTypes";

export interface ProviderRetryManager {
  retry(context: ProviderRetryContext): Promise<ProviderRetryContext> | ProviderRetryContext;
}
