import type { ProviderUploadContext, ProviderUploadResult } from "../types/providerIntegrationTypes";

export interface ProviderAssetManager {
  uploadAssets(context: ProviderUploadContext): Promise<ProviderUploadResult> | ProviderUploadResult;
}
