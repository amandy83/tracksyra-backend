import type { ConnectorMetadataMap } from "../types/connectorTypes";

export class ConnectorMetadata {
  readonly connectorId: string;
  readonly releaseId: string;
  readonly payload: ConnectorMetadataMap;
  readonly language: string | null;
  readonly territories: readonly string[];
  readonly createdAt: string;

  constructor(input: {
    connectorId: string;
    releaseId: string;
    payload: ConnectorMetadataMap;
    language?: string | null;
    territories?: readonly string[];
    createdAt?: string;
  }) {
    this.connectorId = input.connectorId.trim();
    this.releaseId = input.releaseId.trim();
    this.payload = Object.freeze({ ...(input.payload ?? {}) });
    this.language = input.language ?? null;
    this.territories = Object.freeze([...(input.territories ?? [])]);
    this.createdAt = input.createdAt ?? new Date().toISOString();
    if (!this.connectorId || !this.releaseId) {
      throw new Error("ConnectorMetadata requires connectorId and releaseId");
    }
    Object.freeze(this);
  }
}

export interface MetadataProvider {
  submitMetadata(metadata: ConnectorMetadata): Promise<ConnectorMetadata> | ConnectorMetadata;
}

