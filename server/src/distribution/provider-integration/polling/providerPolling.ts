import type { ProviderPollingResult } from "../types/providerIntegrationTypes";

export interface ProviderPollingManager {
  poll(providerName: string): Promise<ProviderPollingResult> | ProviderPollingResult;
}
