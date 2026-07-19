import type { StorageAdapter } from "./adapter";
import type { StorageConsistencyState, StorageMetadata } from "./storageTypes";
import { AdapterStorageRepository } from "./repository";

export interface StorageEngine {
  adapter(name?: string | null): StorageAdapter | null;
  repository<TValue>(name: string): AdapterStorageRepository<TValue>;
  health(): StorageConsistencyState;
}

export class DefaultStorageEngine implements StorageEngine {
  constructor(
    private readonly adapters: ReadonlyMap<string, StorageAdapter>,
    private readonly repositoryFactory: <TValue>(adapter: StorageAdapter) => AdapterStorageRepository<TValue>,
  ) {}

  adapter(name?: string | null): StorageAdapter | null {
    if (!name) return this.adapters.values().next().value ?? null;
    return this.adapters.get(name) ?? null;
  }

  repository<TValue>(name: string): AdapterStorageRepository<TValue> {
    const adapter = this.adapter(name);
    if (!adapter) {
      throw new Error(`Storage adapter not found: ${name}`);
    }
    return this.repositoryFactory<TValue>(adapter);
  }

  health(): StorageConsistencyState {
    return [...this.adapters.values()].every((adapter) => adapter.health() === "consistent") ? "consistent" : "unknown";
  }
}

export type StorageEngineConfiguration = Readonly<{
  defaultAdapter: string;
  metadata?: StorageMetadata;
}>;
