import type { ProviderUploadResult } from "../types/providerIntegrationTypes";

export interface ProviderTakedownManager {
  takedown(providerName: string): Promise<ProviderUploadResult> | ProviderUploadResult;
}
