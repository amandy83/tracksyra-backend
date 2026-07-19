import type { StorageAdapter } from "./adapter";

export interface StorageRegistry {
  register(name: string, adapter: StorageAdapter): void;
  resolve(name: string): StorageAdapter | null;
  list(): readonly string[];
}

export class DefaultStorageRegistry implements StorageRegistry {
  private readonly adapters = new Map<string, StorageAdapter>();

  register(name: string, adapter: StorageAdapter): void {
    this.adapters.set(name, adapter);
  }

  resolve(name: string): StorageAdapter | null {
    return this.adapters.get(name) ?? null;
  }

  list(): readonly string[] {
    return Object.freeze([...this.adapters.keys()]);
  }
}
