import { createHash } from "node:crypto";
import { storageKey } from "../storage/adapter";
import type { StorageRepository } from "../storage/repository";

export type PersistentMapEnvelope<TValue> = Readonly<{
  version: number;
  updatedAt: string;
  entries: readonly (readonly [string, TValue])[];
}>;

function nowIso(): string {
  return new Date().toISOString();
}

function freezeEntries<TValue>(entries: Iterable<readonly [string, TValue]>): readonly (readonly [string, TValue])[] {
  return Object.freeze([...entries].map(([entryKey, value]) => [entryKey, value] as const));
}

function hashKey(key: string): string {
  return createHash("sha256").update(key, "utf8").digest("hex");
}

function freezeEnvelope<TValue>(envelope: PersistentMapEnvelope<TValue>): PersistentMapEnvelope<TValue> {
  return Object.freeze({
    version: envelope.version,
    updatedAt: envelope.updatedAt,
    entries: freezeEntries(envelope.entries),
  });
}

export class PersistentMap<K, V> {
  private readonly repository: StorageRepository<PersistentMapEnvelope<V>>;
  private cache = new Map<string, V>();
  private version = 0;
  private loaded = false;

  constructor(
    repository: StorageRepository<PersistentMapEnvelope<V>>,
    private readonly key: string,
    private readonly serializeKey: (key: K) => string = (value) => String(value),
    private readonly deserializeKey: (key: string) => K = (value) => value as unknown as K,
  ) {
    this.repository = repository;
  }

  private ensureLoaded(): void {
    if (this.loaded) return;
    const envelope = this.repository.find(this.key);
    if (envelope?.value) {
      this.version = envelope.version;
      this.cache = new Map(envelope.value.entries);
    }
    this.loaded = true;
  }

  private persist(): void {
    const nextVersion = this.version + 1;
    const snapshot = freezeEnvelope({
      version: nextVersion,
      updatedAt: nowIso(),
      entries: freezeEntries(this.cache.entries()),
    });
    const stored = this.repository.save(this.key, snapshot, {
      key: this.key,
      version: nextVersion,
      updatedAt: snapshot.updatedAt,
    });
    this.version = stored.version;
  }

  private keyOf(key: K): string {
    return this.serializeKey(key);
  }

  get(key: K): V | undefined {
    this.ensureLoaded();
    return this.cache.get(this.keyOf(key));
  }

  set(key: K, value: V): this {
    this.ensureLoaded();
    this.cache.set(this.keyOf(key), value);
    this.persist();
    return this;
  }

  has(key: K): boolean {
    this.ensureLoaded();
    return this.cache.has(this.keyOf(key));
  }

  delete(key: K): boolean {
    this.ensureLoaded();
    const result = this.cache.delete(this.keyOf(key));
    if (result) {
      this.persist();
    }
    return result;
  }

  clear(): void {
    this.ensureLoaded();
    this.cache.clear();
    this.persist();
  }

  values(): readonly V[] {
    this.ensureLoaded();
    return Object.freeze([...this.cache.values()]);
  }

  entries(): readonly (readonly [K, V])[] {
    this.ensureLoaded();
    return Object.freeze([...this.cache.entries()].map(([entryKey, value]) => [this.deserializeKey(entryKey), value] as const));
  }

  keys(): readonly K[] {
    this.ensureLoaded();
    return Object.freeze([...this.cache.keys()].map((entryKey) => this.deserializeKey(entryKey)));
  }

  snapshot(): PersistentMapEnvelope<V> {
    this.ensureLoaded();
    return freezeEnvelope({
      version: this.version,
      updatedAt: nowIso(),
      entries: freezeEntries(this.cache.entries()),
    });
  }

  get size(): number {
    this.ensureLoaded();
    return this.cache.size;
  }

  [Symbol.iterator](): IterableIterator<[K, V]> {
    this.ensureLoaded();
    return this.entries().map((entry) => [...entry] as [K, V])[Symbol.iterator]();
  }
}

export function createPersistentMapKey(namespace: string, name: string): string {
  return storageKey(`persistent/${namespace}`, hashKey(name));
}
