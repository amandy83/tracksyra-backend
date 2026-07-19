import type { ConnectorMetadataMap, ConnectorStatusCategory } from "../types/connectorTypes";
export type { ConnectorStatusCategory } from "../types/connectorTypes";

export class ConnectorStatus {
  readonly connectorId: string;
  readonly releaseId: string;
  readonly status: ConnectorStatusCategory;
  readonly providerStatus: string;
  readonly observedAt: string;
  readonly metadata: ConnectorMetadataMap;

  constructor(input: {
    connectorId: string;
    releaseId: string;
    status: ConnectorStatusCategory;
    providerStatus: string;
    observedAt?: string;
    metadata?: ConnectorMetadataMap;
  }) {
    this.connectorId = input.connectorId.trim();
    this.releaseId = input.releaseId.trim();
    this.status = input.status;
    this.providerStatus = input.providerStatus.trim();
    this.observedAt = input.observedAt ?? new Date().toISOString();
    this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
    if (!this.connectorId || !this.releaseId || !this.providerStatus) {
      throw new Error("ConnectorStatus requires connectorId, releaseId, and providerStatus");
    }
    Object.freeze(this);
  }
}

export interface StatusProvider {
  getStatus(releaseId: string): Promise<ConnectorStatus> | ConnectorStatus;
}
