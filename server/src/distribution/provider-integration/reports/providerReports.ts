import type { ProviderReportBatch } from "../types/providerIntegrationTypes";

export interface ProviderReportManager {
  generateReports(batch: ProviderReportBatch): Promise<ProviderReportBatch> | ProviderReportBatch;
}
