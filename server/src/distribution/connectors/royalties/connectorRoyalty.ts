import type { ConnectorMetadataMap, ConnectorRoyaltyFeature } from "../types/connectorTypes";
export type { ConnectorRoyaltyFeature } from "../types/connectorTypes";

export class ConnectorRoyalty {
  readonly connectorId: string;
  readonly releaseId: string;
  readonly features: readonly ConnectorRoyaltyFeature[];
  readonly reportPeriod: string;
  readonly importedAt: string;
  readonly metadata: ConnectorMetadataMap;

  constructor(input: {
    connectorId: string;
    releaseId: string;
    features: readonly ConnectorRoyaltyFeature[];
    reportPeriod: string;
    importedAt?: string;
    metadata?: ConnectorMetadataMap;
  }) {
    this.connectorId = input.connectorId.trim();
    this.releaseId = input.releaseId.trim();
    this.features = Object.freeze([...(input.features ?? [])]);
    this.reportPeriod = input.reportPeriod.trim();
    this.importedAt = input.importedAt ?? new Date().toISOString();
    this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
    if (!this.connectorId || !this.releaseId || !this.reportPeriod) {
      throw new Error("ConnectorRoyalty requires non-empty identifiers");
    }
    Object.freeze(this);
  }
}

export interface RoyaltyProvider {
  importRoyalties(releaseId: string): Promise<ConnectorRoyalty> | ConnectorRoyalty;
}
