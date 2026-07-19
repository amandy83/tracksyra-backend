import type { ProviderRoyaltyBatch } from "../types/providerIntegrationTypes";

export interface ProviderRoyaltyManager {
  importRoyalties(batch: ProviderRoyaltyBatch): Promise<ProviderRoyaltyBatch> | ProviderRoyaltyBatch;
}
