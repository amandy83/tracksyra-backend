import type { ConnectorAuthenticationType, ConnectorMetadataMap } from "../types/connectorTypes";
export type { ConnectorAuthenticationType } from "../types/connectorTypes";

export class ConnectorConfiguration {
  readonly connectorId: string;
  readonly version: string;
  readonly enabled: boolean;
  readonly authenticationType: ConnectorAuthenticationType;
  readonly settings: ConnectorMetadataMap;

  constructor(input: {
    connectorId: string;
    version: string;
    enabled?: boolean;
    authenticationType: ConnectorAuthenticationType;
    settings?: ConnectorMetadataMap;
  }) {
    this.connectorId = input.connectorId.trim();
    this.version = input.version.trim();
    this.enabled = input.enabled ?? true;
    this.authenticationType = input.authenticationType;
    this.settings = Object.freeze({ ...(input.settings ?? {}) });
    if (!this.connectorId || !this.version) {
      throw new Error("ConnectorConfiguration requires connectorId and version");
    }
    Object.freeze(this);
  }
}

export class ConnectorCredentials {
  readonly connectorId: string;
  readonly authenticationType: ConnectorAuthenticationType;
  readonly token: string | null;
  readonly clientId: string | null;
  readonly clientSecret: string | null;
  readonly refreshToken: string | null;
  readonly expiresAt: string | null;
  readonly metadata: ConnectorMetadataMap;

  constructor(input: {
    connectorId: string;
    authenticationType: ConnectorAuthenticationType;
    token?: string | null;
    clientId?: string | null;
    clientSecret?: string | null;
    refreshToken?: string | null;
    expiresAt?: string | null;
    metadata?: ConnectorMetadataMap;
  }) {
    this.connectorId = input.connectorId.trim();
    this.authenticationType = input.authenticationType;
    this.token = input.token ?? null;
    this.clientId = input.clientId ?? null;
    this.clientSecret = input.clientSecret ?? null;
    this.refreshToken = input.refreshToken ?? null;
    this.expiresAt = input.expiresAt ?? null;
    this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
    if (!this.connectorId) {
      throw new Error("ConnectorCredentials.connectorId must not be empty");
    }
    Object.freeze(this);
  }
}
