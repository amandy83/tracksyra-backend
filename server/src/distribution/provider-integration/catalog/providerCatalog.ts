import type { ProviderUploadContext, ProviderUploadResult } from "../types/providerIntegrationTypes";

export interface ProviderCatalogManager {
  createRelease(context: ProviderUploadContext): Promise<ProviderUploadResult> | ProviderUploadResult;
}
