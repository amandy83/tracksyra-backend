import { createHash } from "node:crypto";
import { storageKey } from "../../storage/adapter";
import type { StorageRepository } from "../../storage/repository";
import type { StorageMetadata } from "../../storage/storageTypes";
import type { RuntimeRepositoryBatchOperation, RuntimeRepositoryPage, RuntimeRepositorySnapshot } from "./runtimeRepositoryTypes";

export type RuntimeCollectionState<TValue> = Readonly<{
  version: number;
  updatedAt: string;
  entries: readonly (readonly [string, TValue])[];
  metadata: StorageMetadata;
}>;

function nowIso(): string {
  return new Date().toISOString();
}

function freezeEntries<TValue>(entries: Iterable<readonly [string, TValue]>): readonly (readonly [string, TValue])[] {
  return Object.freeze([...entries].map(([key, value]) => [key, value] as const));
}

function hashKey(key: string): string {
  return createHash("sha256").update(key, "utf8").digest("hex");
}

function freezeState<TValue>(state: RuntimeCollectionState<TValue>): RuntimeCollectionState<TValue> {
  return Object.freeze({
    version: state.version,
    updatedAt: state.updatedAt,
    entries: freezeEntries(state.entries),
    metadata: Object.freeze({ ...state.metadata }),
  });
}

export interface RuntimeRepositoryContract<TKey, TValue> {
  find(key: TKey): TValue | undefined;
  save(key: TKey, value: TValue, metadata?: StorageMetadata): this;
  delete(key: TKey): boolean;
  has(key: TKey): boolean;
  clear(): void;
  values(): readonly TValue[];
  entries(): readonly (readonly [TKey, TValue])[];
  keys(): readonly TKey[];
  snapshot(): RuntimeRepositorySnapshot<TValue>;
  history(): readonly RuntimeRepositorySnapshot<TValue>[];
  stream(): IterableIterator<[TKey, TValue]>;
  page(offset: number, limit: number): RuntimeRepositoryPage<TValue>;
  filter(predicate: (entry: readonly [TKey, TValue]) => boolean): readonly (readonly [TKey, TValue])[];
  batch(operation: RuntimeRepositoryBatchOperation<TValue>): void;
  compact(): boolean;
  readonly size: number;
}

export class RuntimeRepository<TKey, TValue> implements RuntimeRepositoryContract<TKey, TValue> {
  private readonly repository: StorageRepository<RuntimeCollectionState<TValue>>;
  private cache = new Map<string, TValue>();
  private version = 0;
  private loaded = false;

  constructor(
    repository: StorageRepository<RuntimeCollectionState<TValue>>,
    private readonly namespace: string,
    private readonly name: string,
    private readonly serializeKey: (key: TKey) => string = (value) => String(value),
    private readonly deserializeKey: (key: string) => TKey = (value) => value as unknown as TKey,
  ) {
    this.repository = repository;
  }

  private get storageKey(): string {
    return storageKey(`runtime/${this.namespace}`, hashKey(this.name));
  }

  private ensureLoaded(): void {
    if (this.loaded) return;
    const envelope = this.repository.find(this.storageKey);
    if (envelope?.value) {
      this.version = envelope.version;
      this.cache = new Map(envelope.value.entries);
    }
    this.loaded = true;
  }

  private persist(metadata: StorageMetadata = {}): void {
    const nextVersion = this.version + 1;
    const state = freezeState({
      version: nextVersion,
      updatedAt: nowIso(),
      entries: freezeEntries(this.cache.entries()),
      metadata: Object.freeze({ namespace: this.namespace, name: this.name, ...metadata }),
    });
    const stored = this.repository.save(this.storageKey, state, state.metadata);
    this.version = stored.version;
  }

  private keyOf(key: TKey): string {
    return this.serializeKey(key);
  }

  get(key: TKey): TValue | undefined {
    return this.find(key);
  }

  set(key: TKey, value: TValue, metadata: StorageMetadata = {}): this {
    return this.save(key, value, metadata);
  }

  find(key: TKey): TValue | undefined {
    this.ensureLoaded();
    return this.cache.get(this.keyOf(key));
  }

  save(key: TKey, value: TValue, metadata: StorageMetadata = {}): this {
    this.ensureLoaded();
    this.cache.set(this.keyOf(key), value);
    this.persist(metadata);
    return this;
  }

  delete(key: TKey): boolean {
    this.ensureLoaded();
    const removed = this.cache.delete(this.keyOf(key));
    if (removed) {
      this.persist();
    }
    return removed;
  }

  has(key: TKey): boolean {
    this.ensureLoaded();
    return this.cache.has(this.keyOf(key));
  }

  clear(): void {
    this.ensureLoaded();
    this.cache.clear();
    this.persist();
  }

  values(): readonly TValue[] {
    this.ensureLoaded();
    return Object.freeze([...this.cache.values()]);
  }

  entries(): readonly (readonly [TKey, TValue])[] {
    this.ensureLoaded();
    return Object.freeze([...this.cache.entries()].map(([entryKey, value]) => [this.deserializeKey(entryKey), value] as const));
  }

  keys(): readonly TKey[] {
    this.ensureLoaded();
    return Object.freeze([...this.cache.keys()].map((entryKey) => this.deserializeKey(entryKey)));
  }

  snapshot(): RuntimeRepositorySnapshot<TValue> {
    this.ensureLoaded();
    return Object.freeze({
      version: this.version,
      updatedAt: nowIso(),
      entries: freezeEntries(this.cache.entries()),
      metadata: Object.freeze({ namespace: this.namespace, name: this.name }),
    });
  }

  history(): readonly RuntimeRepositorySnapshot<TValue>[] {
    return Object.freeze([this.snapshot()]);
  }

  stream(): IterableIterator<[TKey, TValue]> {
    this.ensureLoaded();
    return this.entries().map((entry) => [...entry] as [TKey, TValue])[Symbol.iterator]();
  }

  page(offset: number, limit: number): RuntimeRepositoryPage<TValue> {
    this.ensureLoaded();
    const items = this.entries().slice(offset, offset + limit).map(([key, value]) => [this.keyOf(key), value] as const);
    return Object.freeze({
      items,
      total: this.cache.size,
      offset,
      limit,
    });
  }

  filter(predicate: (entry: readonly [TKey, TValue]) => boolean): readonly (readonly [TKey, TValue])[] {
    this.ensureLoaded();
    return Object.freeze(this.entries().filter(predicate));
  }

  batch(operation: RuntimeRepositoryBatchOperation<TValue>): void {
    this.ensureLoaded();
    for (const key of operation.delete ?? []) {
      this.cache.delete(key);
    }
    for (const [key, value] of operation.set ?? []) {
      this.cache.set(key, value);
    }
    this.persist(operation.metadata ?? {});
  }

  compact(): boolean {
    this.ensureLoaded();
    this.persist({ compacted: true });
    return true;
  }

  get size(): number {
    this.ensureLoaded();
    return this.cache.size;
  }
}

export class WorkerRepository<TKey, TValue> extends RuntimeRepository<TKey, TValue> {}
export class WorkflowRepository<TKey, TValue> extends RuntimeRepository<TKey, TValue> {}
export class DeliveryRepository<TKey, TValue> extends RuntimeRepository<TKey, TValue> {}
export class PackageRepository<TKey, TValue> extends RuntimeRepository<TKey, TValue> {}
export class CheckpointRepository<TKey, TValue> extends RuntimeRepository<TKey, TValue> {}
export class RecoveryRepository<TKey, TValue> extends RuntimeRepository<TKey, TValue> {}
export class SnapshotRepository<TKey, TValue> extends RuntimeRepository<TKey, TValue> {}
export class ProjectionRepository<TKey, TValue> extends RuntimeRepository<TKey, TValue> {}
export class ExecutionRepository<TKey, TValue> extends RuntimeRepository<TKey, TValue> {}
export class QueueRepository<TKey, TValue> extends RuntimeRepository<TKey, TValue> {}
export class ProviderRepository<TKey, TValue> extends RuntimeRepository<TKey, TValue> {}
export class PartnerRepository<TKey, TValue> extends RuntimeRepository<TKey, TValue> {}
export class CredentialRepository<TKey, TValue> extends RuntimeRepository<TKey, TValue> {}
export class StateRepository<TKey, TValue> extends RuntimeRepository<TKey, TValue> {}
export class AuditRepository<TKey, TValue> extends RuntimeRepository<TKey, TValue> {}
export class TimelineRepository<TKey, TValue> extends RuntimeRepository<TKey, TValue> {}
export class MetricsRepository<TKey, TValue> extends RuntimeRepository<TKey, TValue> {}
export class HealthRepository<TKey, TValue> extends RuntimeRepository<TKey, TValue> {}
export class RoyaltyRepository<TKey, TValue> extends RuntimeRepository<TKey, TValue> {}
export class BootstrapRepository<TKey, TValue> extends RuntimeRepository<TKey, TValue> {}
export class ValidationRepository<TKey, TValue> extends RuntimeRepository<TKey, TValue> {}

export type RuntimeRepositoryFactory<TKey, TValue> = (
  repository: StorageRepository<RuntimeCollectionState<TValue>>,
  namespace: string,
  name: string,
  serializeKey?: (key: TKey) => string,
  deserializeKey?: (key: string) => TKey,
) => RuntimeRepository<TKey, TValue>;

export function createRuntimeRepository<TKey, TValue>(
  repository: StorageRepository<RuntimeCollectionState<TValue>>,
  namespace: string,
  name: string,
  factory: RuntimeRepositoryFactory<TKey, TValue>,
  serializeKey?: (key: TKey) => string,
  deserializeKey?: (key: string) => TKey,
): RuntimeRepository<TKey, TValue> {
  return factory(repository, namespace, name, serializeKey, deserializeKey);
}
