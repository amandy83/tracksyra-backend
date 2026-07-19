export class DefaultStorageFactory {
    registry;
    engineFactory;
    constructor(registry, engineFactory) {
        this.registry = registry;
        this.engineFactory = engineFactory;
    }
    createEngine() {
        return this.engineFactory(new Map(this.registry.list().map((name) => [name, this.registry.resolve(name)])));
    }
    createRegistry() {
        return this.registry;
    }
    createAdapter(name) {
        return this.registry.resolve(name);
    }
}
