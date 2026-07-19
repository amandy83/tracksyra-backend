import type { ConnectorMetadataMap } from "../types/connectorTypes";

export class ConnectorError extends Error {
  readonly connectorId: string;
  readonly code: string;
  readonly retryable: boolean;
  readonly metadata: ConnectorMetadataMap;

  constructor(input: {
    connectorId: string;
    code: string;
    message: string;
    retryable?: boolean;
    metadata?: ConnectorMetadataMap;
  }) {
    super(input.message);
    this.connectorId = input.connectorId.trim();
    this.code = input.code.trim();
    this.retryable = input.retryable ?? false;
    this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
    if (!this.connectorId || !this.code) {
      throw new Error("ConnectorError requires connectorId and code");
    }
    Object.freeze(this);
  }
}

