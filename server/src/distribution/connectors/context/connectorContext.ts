import type { ConnectorConfiguration } from "../configuration/connectorConfiguration";
import type { ConnectorAttributeMap, ConnectorMetadataMap } from "../types/connectorTypes";

export class ConnectorContext {
  readonly connectorId: string;
  readonly connectorVersion: string;
  readonly releaseId: string;
  readonly executionId: string;
  readonly providerReference: string | null;
  readonly configuration: ConnectorConfiguration;
  readonly metadata: ConnectorMetadataMap;
  readonly attributes: ConnectorAttributeMap;
  readonly createdAt: string;

  constructor(input: {
    connectorId: string;
    connectorVersion: string;
    releaseId: string;
    executionId: string;
    configuration: ConnectorConfiguration;
    providerReference?: string | null;
    metadata?: ConnectorMetadataMap;
    attributes?: ConnectorAttributeMap;
    createdAt?: string;
  }) {
    this.connectorId = input.connectorId.trim();
    this.connectorVersion = input.connectorVersion.trim();
    this.releaseId = input.releaseId.trim();
    this.executionId = input.executionId.trim();
    this.providerReference = input.providerReference ?? null;
    this.configuration = input.configuration;
    this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
    this.attributes = Object.freeze({ ...(input.attributes ?? {}) });
    this.createdAt = input.createdAt ?? new Date().toISOString();
    if (!this.connectorId || !this.connectorVersion || !this.releaseId || !this.executionId) {
      throw new Error("ConnectorContext requires non-empty identifiers");
    }
    Object.freeze(this);
  }
}

