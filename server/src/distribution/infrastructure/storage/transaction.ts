import type { StorageMetadata } from "./storageTypes";
import type { StorageRepository } from "./repository";

export interface StorageTransaction {
  commit(): void;
  rollback(): void;
  readonly active: boolean;
  readonly metadata: StorageMetadata;
}

export class DefaultStorageTransaction implements StorageTransaction {
  active = true;

  constructor(private readonly repository: StorageRepository<unknown>, readonly metadata: StorageMetadata = {}) {
    Object.freeze(this.metadata);
  }

  commit(): void {
    this.active = false;
  }

  rollback(): void {
    this.active = false;
  }
}
