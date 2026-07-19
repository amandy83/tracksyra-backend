function nowIso() {
    return new Date().toISOString();
}
export class AdapterStorageRepository {
    adapter;
    constructor(adapter) {
        this.adapter = adapter;
    }
    find(key) {
        return this.adapter.read(key);
    }
    save(key, value, metadata = {}) {
        const current = this.find(key);
        const envelope = Object.freeze({
            key,
            value,
            version: (current?.version ?? 0) + 1,
            updatedAt: nowIso(),
            deletedAt: null,
            archivedAt: current?.archivedAt ?? null,
            metadata: Object.freeze({ ...metadata }),
        });
        if (!this.adapter.compareAndSwap(key, current?.version ?? 0, envelope)) {
            throw new Error(`Storage optimistic locking conflict for ${key}`);
        }
        return envelope;
    }
    delete(key) {
        this.adapter.delete(key);
    }
    archive(key) {
        const current = this.find(key);
        if (!current)
            return null;
        const archived = Object.freeze({
            ...current,
            archivedAt: nowIso(),
        });
        this.adapter.write(key, archived);
        return archived;
    }
    restore(key) {
        return this.find(key);
    }
    checkpoint(key, owner, metadata = {}) {
        const current = this.find(key);
        return Object.freeze({
            checkpointId: `${key}:${Date.now().toString(36)}`,
            resource: key,
            owner,
            version: current?.version ?? 0,
            createdAt: nowIso(),
            metadata: Object.freeze({ ...metadata }),
        });
    }
    snapshot(key) {
        const current = this.find(key);
        return current ? Object.freeze({
            snapshotId: `${key}:${current.version}`,
            resource: key,
            version: current.version,
            createdAt: current.updatedAt,
            value: current.value,
            metadata: current.metadata,
        }) : null;
    }
    compact(key) {
        const current = this.find(key);
        return {
            compacted: Boolean(current),
            removedVersions: current ? Math.max(0, current.version - 1) : 0,
            retainedVersions: current ? 1 : 0,
            metadata: Object.freeze({ key }),
        };
    }
    migrate(version, metadata = {}) {
        return {
            migrated: true,
            fromVersion: null,
            toVersion: version,
            metadata: Object.freeze({ ...metadata }),
        };
    }
    history(key) {
        const current = this.find(key);
        return Object.freeze(current ? [current] : []);
    }
}
