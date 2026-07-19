import type { ConnectorMetadataMap } from "../types/connectorTypes";
import type { ConnectorAsset } from "../assets/connectorAsset";

export class ConnectorDelivery {
  readonly deliveryId: string;
  readonly connectorId: string;
  readonly releaseId: string;
  readonly assets: readonly ConnectorAsset[];
  readonly submittedAt: string;
  readonly metadata: ConnectorMetadataMap;

  constructor(input: {
    deliveryId: string;
    connectorId: string;
    releaseId: string;
    assets: readonly ConnectorAsset[];
    submittedAt?: string;
    metadata?: ConnectorMetadataMap;
  }) {
    this.deliveryId = input.deliveryId.trim();
    this.connectorId = input.connectorId.trim();
    this.releaseId = input.releaseId.trim();
    this.assets = Object.freeze([...(input.assets ?? [])]);
    this.submittedAt = input.submittedAt ?? new Date().toISOString();
    this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
    if (!this.deliveryId || !this.connectorId || !this.releaseId) {
      throw new Error("ConnectorDelivery requires non-empty identifiers");
    }
    Object.freeze(this);
  }
}

