import type { StorageAdapter } from "./adapter";
import type { StorageRegistry } from "./registry";

export interface StorageResolver {
  resolve(name: string): StorageAdapter | null;
}

export class DefaultStorageResolver implements StorageResolver {
  constructor(private readonly registry: StorageRegistry) {}

  resolve(name: string): StorageAdapter | null {
    return this.registry.resolve(name);
  }
}
