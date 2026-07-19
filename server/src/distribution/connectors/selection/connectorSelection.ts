import type { DSPConnector } from "../contracts/connectorContracts";
import type { ConnectorCapabilities } from "../capabilities/connectorCapabilities";
import type { ConnectorContext } from "../context/connectorContext";

export interface ConnectorSelector {
  select(context: ConnectorContext, capabilities: readonly ConnectorCapabilities[], connectors: readonly DSPConnector[]): DSPConnector | null;
}
