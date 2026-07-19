import type { StorageAdapter } from "./adapter";
import type { StorageCheckpointRecord, StorageCompactionResult, StorageEnvelope, StorageMigrationResult, StorageMetadata, StorageSnapshotRecord } from "./storageTypes";

export interface StorageRepository<TValue> {
  find(key: string): StorageEnvelope<TValue> | null;
  save(key: string, value: TValue, metadata?: StorageMetadata): StorageEnvelope<TValue>;
  delete(key: string): void;
  archive(key: string): StorageEnvelope<TValue> | null;
  restore(key: string): StorageEnvelope<TValue> | null;
  checkpoint(key: string, owner: string, metadata?: StorageMetadata): StorageCheckpointRecord;
  snapshot(key: string): StorageSnapshotRecord<TValue> | null;
  compact(key: string): StorageCompactionResult;
  migrate(version: string, metadata?: StorageMetadata): StorageMigrationResult;
  history(key: string): readonly StorageEnvelope<TValue>[];
}

function nowIso(): string {
  return new Date().toISOString();
}

export class AdapterStorageRepository<TValue> implements StorageRepository<TValue> {
  constructor(private readonly adapter: StorageAdapter) {}

  find(key: string): StorageEnvelope<TValue> | null {
    return this.adapter.read<TValue>(key);
  }

  save(key: string, value: TValue, metadata: StorageMetadata = {}): StorageEnvelope<TValue> {
    const current = this.find(key);
    const envelope: StorageEnvelope<TValue> = Object.freeze({
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

  delete(key: string): void {
    this.adapter.delete(key);
  }

  archive(key: string): StorageEnvelope<TValue> | null {
    const current = this.find(key);
    if (!current) return null;
    const archived = Object.freeze({
      ...current,
      archivedAt: nowIso(),
    });
    this.adapter.write(key, archived);
    return archived;
  }

  restore(key: string): StorageEnvelope<TValue> | null {
    return this.find(key);
  }

  checkpoint(key: string, owner: string, metadata: StorageMetadata = {}): StorageCheckpointRecord {
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

  snapshot(key: string): StorageSnapshotRecord<TValue> | null {
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

  compact(key: string): StorageCompactionResult {
    const current = this.find(key);
    return {
      compacted: Boolean(current),
      removedVersions: current ? Math.max(0, current.version - 1) : 0,
      retainedVersions: current ? 1 : 0,
      metadata: Object.freeze({ key }),
    };
  }

  migrate(version: string, metadata: StorageMetadata = {}): StorageMigrationResult {
    return {
      migrated: true,
      fromVersion: null,
      toVersion: version,
      metadata: Object.freeze({ ...metadata }),
    };
  }

  history(key: string): readonly StorageEnvelope<TValue>[] {
    const current = this.find(key);
    return Object.freeze(current ? [current] : []);
  }
}
