import type { ConnectorMetadataMap } from "../types/connectorTypes";

export class ConnectorTakedown {
  readonly takedownId: string;
  readonly connectorId: string;
  readonly releaseId: string;
  readonly requestedAt: string;
  readonly completedAt: string | null;
  readonly metadata: ConnectorMetadataMap;

  constructor(input: {
    takedownId: string;
    connectorId: string;
    releaseId: string;
    requestedAt?: string;
    completedAt?: string | null;
    metadata?: ConnectorMetadataMap;
  }) {
    this.takedownId = input.takedownId.trim();
    this.connectorId = input.connectorId.trim();
    this.releaseId = input.releaseId.trim();
    this.requestedAt = input.requestedAt ?? new Date().toISOString();
    this.completedAt = input.completedAt ?? null;
    this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
    if (!this.takedownId || !this.connectorId || !this.releaseId) {
      throw new Error("ConnectorTakedown requires non-empty identifiers");
    }
    Object.freeze(this);
  }
}

export interface TakedownProvider {
  takedownRelease(releaseId: string): Promise<ConnectorTakedown> | ConnectorTakedown;
}

