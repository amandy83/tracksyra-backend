export class DefaultStorageCompaction {
    compact(resource, metadata = {}) {
        return {
            compacted: true,
            removedVersions: 0,
            retainedVersions: 1,
            metadata: Object.freeze({ resource, ...metadata }),
        };
    }
}
