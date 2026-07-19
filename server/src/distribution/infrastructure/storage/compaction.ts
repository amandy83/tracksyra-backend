import type { StorageCompactionResult, StorageMetadata } from "./storageTypes";

export interface StorageCompaction {
  compact(resource: string, metadata?: StorageMetadata): StorageCompactionResult;
}

export class DefaultStorageCompaction implements StorageCompaction {
  compact(resource: string, metadata: StorageMetadata = {}): StorageCompactionResult {
    return {
      compacted: true,
      removedVersions: 0,
      retainedVersions: 1,
      metadata: Object.freeze({ resource, ...metadata }),
    };
  }
}
