import type { DSPConnector, ConnectorFactory } from "../contracts/connectorContracts";
import type { ConnectorCapabilities } from "../capabilities/connectorCapabilities";
import type { ConnectorContext } from "../context/connectorContext";

export interface ConnectorRegistry {
  register(connector: DSPConnector): void;
  resolve(connectorId: string): DSPConnector | null;
  list(): readonly DSPConnector[];
}

export interface ConnectorResolver {
  resolve(context: ConnectorContext, capabilities?: readonly ConnectorCapabilities[]): DSPConnector | null;
}

export class InMemoryConnectorRegistry implements ConnectorRegistry {
  private readonly connectors = new Map<string, DSPConnector>();

  register(connector: DSPConnector): void {
    this.connectors.set(connector.connectorId, connector);
  }

  resolve(connectorId: string): DSPConnector | null {
    return this.connectors.get(connectorId) ?? null;
  }

  list(): readonly DSPConnector[] {
    return Object.freeze([...this.connectors.values()]);
  }
}

export class DefaultConnectorResolver implements ConnectorResolver {
  constructor(private readonly registry: ConnectorRegistry) {}

  resolve(context: ConnectorContext): DSPConnector | null {
    return this.registry.resolve(context.connectorId);
  }
}

