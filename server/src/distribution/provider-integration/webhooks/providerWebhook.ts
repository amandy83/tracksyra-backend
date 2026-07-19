import type { ProviderStatusSnapshot, ProviderWebhookEnvelope } from "../types/providerIntegrationTypes";

export interface ProviderWebhookManager {
  receiveWebhook(event: ProviderWebhookEnvelope): Promise<ProviderStatusSnapshot> | ProviderStatusSnapshot;
}
