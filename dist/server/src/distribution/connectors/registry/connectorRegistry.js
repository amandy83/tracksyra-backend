export class InMemoryConnectorRegistry {
    connectors = new Map();
    register(connector) {
        this.connectors.set(connector.connectorId, connector);
    }
    resolve(connectorId) {
        return this.connectors.get(connectorId) ?? null;
    }
    list() {
        return Object.freeze([...this.connectors.values()]);
    }
}
export class DefaultConnectorResolver {
    registry;
    constructor(registry) {
        this.registry = registry;
    }
    resolve(context) {
        return this.registry.resolve(context.connectorId);
    }
}
