import type { StorageMetadata, StorageSnapshotRecord } from "./storageTypes";

export interface StorageSnapshot<TValue> {
  capture(resource: string, version: number, value: TValue, metadata?: StorageMetadata): StorageSnapshotRecord<TValue>;
  restore(snapshot: StorageSnapshotRecord<TValue>): TValue;
}

export class DefaultStorageSnapshot<TValue> implements StorageSnapshot<TValue> {
  capture(resource: string, version: number, value: TValue, metadata: StorageMetadata = {}): StorageSnapshotRecord<TValue> {
    return Object.freeze({
      snapshotId: `${resource}:${version}`,
      resource,
      version,
      createdAt: new Date().toISOString(),
      value,
      metadata: Object.freeze({ ...metadata }),
    });
  }

  restore(snapshot: StorageSnapshotRecord<TValue>): TValue {
    return snapshot.value;
  }
}
