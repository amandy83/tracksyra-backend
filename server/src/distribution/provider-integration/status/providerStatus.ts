import type { ProviderStatusSnapshot, ProviderUploadContext } from "../types/providerIntegrationTypes";

export interface ProviderStatusManager {
  trackStatus(snapshot: ProviderStatusSnapshot | ProviderUploadContext): Promise<ProviderStatusSnapshot> | ProviderStatusSnapshot;
  reconcile(snapshot: ProviderStatusSnapshot): Promise<ProviderStatusSnapshot> | ProviderStatusSnapshot;
}
