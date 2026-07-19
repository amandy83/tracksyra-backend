export class DefaultStorageResolver {
    registry;
    constructor(registry) {
        this.registry = registry;
    }
    resolve(name) {
        return this.registry.resolve(name);
    }
}
