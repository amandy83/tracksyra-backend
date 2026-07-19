import type { ProviderUploadContext, ProviderUploadResult } from "../types/providerIntegrationTypes";

export interface ProviderMetadataManager {
  submitMetadata(context: ProviderUploadContext): Promise<ProviderUploadResult> | ProviderUploadResult;
}
