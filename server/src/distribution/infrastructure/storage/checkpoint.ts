import type { StorageCheckpointRecord, StorageMetadata } from "./storageTypes";

export interface StorageCheckpoint {
  create(resource: string, owner: string, version: number, metadata?: StorageMetadata): StorageCheckpointRecord;
}

export class DefaultStorageCheckpoint implements StorageCheckpoint {
  create(resource: string, owner: string, version: number, metadata: StorageMetadata = {}): StorageCheckpointRecord {
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
