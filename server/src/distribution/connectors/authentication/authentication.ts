import type { ConnectorConfiguration, ConnectorCredentials } from "../configuration/connectorConfiguration";
import type { ConnectorContext } from "../context/connectorContext";
import type { ConnectorMetadataMap } from "../types/connectorTypes";

export class ConnectorAuthenticationResult {
  readonly connectorId: string;
  readonly authenticated: boolean;
  readonly credentials: ConnectorCredentials;
  readonly authenticatedAt: string;
  readonly expiresAt: string | null;
  readonly metadata: ConnectorMetadataMap;

  constructor(input: {
    connectorId: string;
    authenticated: boolean;
    credentials: ConnectorCredentials;
    authenticatedAt?: string;
    expiresAt?: string | null;
    metadata?: ConnectorMetadataMap;
  }) {
    this.connectorId = input.connectorId.trim();
    this.authenticated = input.authenticated;
    this.credentials = input.credentials;
    this.authenticatedAt = input.authenticatedAt ?? new Date().toISOString();
    this.expiresAt = input.expiresAt ?? null;
    this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
    if (!this.connectorId) {
      throw new Error("ConnectorAuthenticationResult.connectorId must not be empty");
    }
    Object.freeze(this);
  }
}

export interface AuthenticationProvider {
  authenticate(context: ConnectorContext, configuration: ConnectorConfiguration): Promise<ConnectorAuthenticationResult> | ConnectorAuthenticationResult;
}

