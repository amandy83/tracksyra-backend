export type StorageMetadata = Readonly<Record<string, unknown>>;

export type StorageVersionName = string;

export type StorageConsistencyState = "consistent" | "stale" | "conflicted" | "unknown";

export type StorageTransactionMode = "read" | "write" | "readwrite";

export type StorageLockMode = "shared" | "exclusive";

export type StorageOwnershipState = "owned" | "leased" | "stale" | "released" | "unknown";

export type StorageEnvelope<TValue> = Readonly<{
  key: string;
  value: TValue;
  version: number;
  updatedAt: string;
  deletedAt: string | null;
  archivedAt: string | null;
  metadata: StorageMetadata;
}>;

export type StorageCompactionResult = Readonly<{
  compacted: boolean;
  removedVersions: number;
  retainedVersions: number;
  metadata: StorageMetadata;
}>;

export type StorageMigrationResult = Readonly<{
  migrated: boolean;
  fromVersion: string | null;
  toVersion: string;
  metadata: StorageMetadata;
}>;

export type StorageCheckpointRecord = Readonly<{
  checkpointId: string;
  resource: string;
  owner: string;
  version: number;
  createdAt: string;
  metadata: StorageMetadata;
}>;

export type StorageSnapshotRecord<TValue> = Readonly<{
  snapshotId: string;
  resource: string;
  version: number;
  createdAt: string;
  value: TValue;
  metadata: StorageMetadata;
}>;
