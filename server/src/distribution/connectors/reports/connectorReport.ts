import type { ConnectorMetadataMap } from "../types/connectorTypes";

export class ConnectorReport {
  readonly reportId: string;
  readonly connectorId: string;
  readonly releaseId: string;
  readonly reportType: string;
  readonly generatedAt: string;
  readonly payload: ConnectorMetadataMap;

  constructor(input: {
    reportId: string;
    connectorId: string;
    releaseId: string;
    reportType: string;
    generatedAt?: string;
    payload?: ConnectorMetadataMap;
  }) {
    this.reportId = input.reportId.trim();
    this.connectorId = input.connectorId.trim();
    this.releaseId = input.releaseId.trim();
    this.reportType = input.reportType.trim();
    this.generatedAt = input.generatedAt ?? new Date().toISOString();
    this.payload = Object.freeze({ ...(input.payload ?? {}) });
    if (!this.reportId || !this.connectorId || !this.releaseId || !this.reportType) {
      throw new Error("ConnectorReport requires non-empty identifiers and reportType");
    }
    Object.freeze(this);
  }
}

export interface ReportProvider {
  generateReport(releaseId: string): Promise<ConnectorReport> | ConnectorReport;
}

