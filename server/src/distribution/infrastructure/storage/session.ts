import type { StorageAdapter } from "./adapter";
import type { StorageLockMode, StorageMetadata, StorageOwnershipState, StorageTransactionMode } from "./storageTypes";

export interface StorageSession {
  readonly sessionId: string;
  readonly adapter: StorageAdapter;
  readonly mode: StorageTransactionMode;
  readonly lockMode: StorageLockMode;
  readonly ownership: StorageOwnershipState;
  readonly createdAt: string;
  readonly metadata: StorageMetadata;
}

export class DefaultStorageSession implements StorageSession {
  constructor(
    readonly sessionId: string,
    readonly adapter: StorageAdapter,
    readonly mode: StorageTransactionMode,
    readonly lockMode: StorageLockMode,
    readonly ownership: StorageOwnershipState = "owned",
    readonly createdAt: string = new Date().toISOString(),
    readonly metadata: StorageMetadata = {},
  ) {
    Object.freeze(this.metadata);
    Object.freeze(this);
  }
}
