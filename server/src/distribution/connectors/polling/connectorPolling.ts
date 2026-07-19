import type { ConnectorMetadataMap } from "../types/connectorTypes";

export class ConnectorPolling {
  readonly pollingId: string;
  readonly connectorId: string;
  readonly releaseId: string;
  readonly requestedAt: string;
  readonly completedAt: string | null;
  readonly payload: ConnectorMetadataMap;

  constructor(input: {
    pollingId: string;
    connectorId: string;
    releaseId: string;
    requestedAt?: string;
    completedAt?: string | null;
    payload?: ConnectorMetadataMap;
  }) {
    this.pollingId = input.pollingId.trim();
    this.connectorId = input.connectorId.trim();
    this.releaseId = input.releaseId.trim();
    this.requestedAt = input.requestedAt ?? new Date().toISOString();
    this.completedAt = input.completedAt ?? null;
    this.payload = Object.freeze({ ...(input.payload ?? {}) });
    if (!this.pollingId || !this.connectorId || !this.releaseId) {
      throw new Error("ConnectorPolling requires non-empty identifiers");
    }
    Object.freeze(this);
  }
}

export interface PollingProvider {
  pollReleaseStatus(releaseId: string): Promise<ConnectorPolling> | ConnectorPolling;
}

