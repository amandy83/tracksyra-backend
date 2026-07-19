export class SnapshotSerializer {
    serialize(snapshot) {
        return `${JSON.stringify(snapshot)}\n`;
    }
    deserialize(payload) {
        return JSON.parse(payload);
    }
}
export class SnapshotStore {
    store;
    serializer;
    constructor(store, serializer) {
        this.store = store;
        this.serializer = serializer;
    }
    async save(key, snapshot) {
        const serialized = this.serializer.serialize(snapshot);
        await this.store.write(key, this.serializer.deserialize(serialized));
    }
    async load(key) {
        return await this.store.read(key);
    }
}
export class SnapshotLoader {
    store;
    constructor(store) {
        this.store = store;
    }
    async load(key) {
        return await this.store.load(key);
    }
}
export class SnapshotComparer {
    compare(before, after) {
        return JSON.stringify(before) === JSON.stringify(after);
    }
}
