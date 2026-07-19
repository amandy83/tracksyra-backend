import type { StorageAdapter } from "./adapter";
import { DefaultStorageEngine, type StorageEngine } from "./engine";
import { DefaultStorageRegistry, type StorageRegistry } from "./registry";

export interface StorageFactory {
  createEngine(): StorageEngine;
  createRegistry(): StorageRegistry;
  createAdapter(name: string): StorageAdapter | null;
}

export class DefaultStorageFactory implements StorageFactory {
  constructor(
    private readonly registry: DefaultStorageRegistry,
    private readonly engineFactory: (adapters: ReadonlyMap<string, StorageAdapter>) => StorageEngine,
  ) {}

  createEngine(): StorageEngine {
    return this.engineFactory(new Map(this.registry.list().map((name) => [name, this.registry.resolve(name)!] as const)));
  }

  createRegistry(): StorageRegistry {
    return this.registry;
  }

  createAdapter(name: string): StorageAdapter | null {
    return this.registry.resolve(name);
  }
}
