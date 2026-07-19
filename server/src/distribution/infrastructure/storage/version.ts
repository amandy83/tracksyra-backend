import type { StorageMetadata } from "./storageTypes";

export interface StorageVersion {
  readonly version: string;
  readonly createdAt: string;
  readonly metadata: StorageMetadata;
}

export class DefaultStorageVersion implements StorageVersion {
  constructor(
    readonly version: string,
    readonly createdAt: string = new Date().toISOString(),
    readonly metadata: StorageMetadata = {},
  ) {
    Object.freeze(this.metadata);
    Object.freeze(this);
  }
}
