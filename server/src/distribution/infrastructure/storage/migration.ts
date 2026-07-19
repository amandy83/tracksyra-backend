import type { StorageMetadata, StorageMigrationResult } from "./storageTypes";

export interface StorageMigration {
  migrate(fromVersion: string | null, toVersion: string, metadata?: StorageMetadata): StorageMigrationResult;
}

export class DefaultStorageMigration implements StorageMigration {
  migrate(fromVersion: string | null, toVersion: string, metadata: StorageMetadata = {}): StorageMigrationResult {
    return {
      migrated: true,
      fromVersion,
      toVersion,
      metadata: Object.freeze({ ...metadata }),
    };
  }
}
