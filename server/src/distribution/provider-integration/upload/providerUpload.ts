import type { ProviderUploadContext, ProviderUploadResult } from "../types/providerIntegrationTypes";

export interface ProviderUploadManager {
  upload(context: ProviderUploadContext): Promise<ProviderUploadResult> | ProviderUploadResult;
}
