export class DefaultStorageCheckpoint {
    create(resource, owner, version, metadata = {}) {
        return Object.freeze({
            checkpointId: `${resource}:${owner}:${version}:${Date.now().toString(36)}`,
            resource,
            owner,
            version,
            createdAt: new Date().toISOString(),
            metadata: Object.freeze({ ...metadata }),
        });
    }
}
