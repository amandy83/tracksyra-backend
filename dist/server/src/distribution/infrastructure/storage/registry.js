export class DefaultStorageRegistry {
    adapters = new Map();
    register(name, adapter) {
        this.adapters.set(name, adapter);
    }
    resolve(name) {
        return this.adapters.get(name) ?? null;
    }
    list() {
        return Object.freeze([...this.adapters.keys()]);
    }
}
