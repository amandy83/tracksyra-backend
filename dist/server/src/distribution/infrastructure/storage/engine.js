export class DefaultStorageEngine {
    adapters;
    repositoryFactory;
    constructor(adapters, repositoryFactory) {
        this.adapters = adapters;
        this.repositoryFactory = repositoryFactory;
    }
    adapter(name) {
        if (!name)
            return this.adapters.values().next().value ?? null;
        return this.adapters.get(name) ?? null;
    }
    repository(name) {
        const adapter = this.adapter(name);
        if (!adapter) {
            throw new Error(`Storage adapter not found: ${name}`);
        }
        return this.repositoryFactory(adapter);
    }
    health() {
        return [...this.adapters.values()].every((adapter) => adapter.health() === "consistent") ? "consistent" : "unknown";
    }
}
