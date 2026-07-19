export class DefaultStorageSnapshot {
    capture(resource, version, value, metadata = {}) {
        return Object.freeze({
            snapshotId: `${resource}:${version}`,
            resource,
            version,
            createdAt: new Date().toISOString(),
            value,
            metadata: Object.freeze({ ...metadata }),
        });
    }
    restore(snapshot) {
        return snapshot.value;
    }
}
