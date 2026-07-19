import type { StorageConsistencyState } from "./storageTypes";

export interface StorageHealthChecker {
  check(): StorageConsistencyState;
}

export class DefaultStorageHealthChecker implements StorageHealthChecker {
  constructor(private readonly checkState: () => StorageConsistencyState) {}

  check(): StorageConsistencyState {
    return this.checkState();
  }
}
