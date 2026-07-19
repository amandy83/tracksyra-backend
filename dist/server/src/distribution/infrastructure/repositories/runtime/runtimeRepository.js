import { createHash } from "node:crypto";
import { storageKey } from "../../storage/adapter.js";
function nowIso() {
    return new Date().toISOString();
}
function freezeEntries(entries) {
    return Object.freeze([...entries].map(([key, value]) => [key, value]));
}
function hashKey(key) {
    return createHash("sha256").update(key, "utf8").digest("hex");
}
function freezeState(state) {
    return Object.freeze({
        version: state.version,
        updatedAt: state.updatedAt,
        entries: freezeEntries(state.entries),
        metadata: Object.freeze({ ...state.metadata }),
    });
}
export class RuntimeRepository {
    namespace;
    name;
    serializeKey;
    deserializeKey;
    repository;
    cache = new Map();
    version = 0;
    loaded = false;
    constructor(repository, namespace, name, serializeKey = (value) => String(value), deserializeKey = (value) => value) {
        this.namespace = namespace;
        this.name = name;
        this.serializeKey = serializeKey;
        this.deserializeKey = deserializeKey;
        this.repository = repository;
    }
    get storageKey() {
        return storageKey(`runtime/${this.namespace}`, hashKey(this.name));
    }
    ensureLoaded() {
        if (this.loaded)
            return;
        const envelope = this.repository.find(this.storageKey);
        if (envelope?.value) {
            this.version = envelope.version;
            this.cache = new Map(envelope.value.entries);
        }
        this.loaded = true;
    }
    persist(metadata = {}) {
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
    keyOf(key) {
        return this.serializeKey(key);
    }
    get(key) {
        return this.find(key);
    }
    set(key, value, metadata = {}) {
        return this.save(key, value, metadata);
    }
    find(key) {
        this.ensureLoaded();
        return this.cache.get(this.keyOf(key));
    }
    save(key, value, metadata = {}) {
        this.ensureLoaded();
        this.cache.set(this.keyOf(key), value);
        this.persist(metadata);
        return this;
    }
    delete(key) {
        this.ensureLoaded();
        const removed = this.cache.delete(this.keyOf(key));
        if (removed) {
            this.persist();
        }
        return removed;
    }
    has(key) {
        this.ensureLoaded();
        return this.cache.has(this.keyOf(key));
    }
    clear() {
        this.ensureLoaded();
        this.cache.clear();
        this.persist();
    }
    values() {
        this.ensureLoaded();
        return Object.freeze([...this.cache.values()]);
    }
    entries() {
        this.ensureLoaded();
        return Object.freeze([...this.cache.entries()].map(([entryKey, value]) => [this.deserializeKey(entryKey), value]));
    }
    keys() {
        this.ensureLoaded();
        return Object.freeze([...this.cache.keys()].map((entryKey) => this.deserializeKey(entryKey)));
    }
    snapshot() {
        this.ensureLoaded();
        return Object.freeze({
            version: this.version,
            updatedAt: nowIso(),
            entries: freezeEntries(this.cache.entries()),
            metadata: Object.freeze({ namespace: this.namespace, name: this.name }),
        });
    }
    history() {
        return Object.freeze([this.snapshot()]);
    }
    stream() {
        this.ensureLoaded();
        return this.entries().map((entry) => [...entry])[Symbol.iterator]();
    }
    page(offset, limit) {
        this.ensureLoaded();
        const items = this.entries().slice(offset, offset + limit).map(([key, value]) => [this.keyOf(key), value]);
        return Object.freeze({
            items,
            total: this.cache.size,
            offset,
            limit,
        });
    }
    filter(predicate) {
        this.ensureLoaded();
        return Object.freeze(this.entries().filter(predicate));
    }
    batch(operation) {
        this.ensureLoaded();
        for (const key of operation.delete ?? []) {
            this.cache.delete(key);
        }
        for (const [key, value] of operation.set ?? []) {
            this.cache.set(key, value);
        }
        this.persist(operation.metadata ?? {});
    }
    compact() {
        this.ensureLoaded();
        this.persist({ compacted: true });
        return true;
    }
    get size() {
        this.ensureLoaded();
        return this.cache.size;
    }
}
export class WorkerRepository extends RuntimeRepository {
}
export class WorkflowRepository extends RuntimeRepository {
}
export class DeliveryRepository extends RuntimeRepository {
}
export class PackageRepository extends RuntimeRepository {
}
export class CheckpointRepository extends RuntimeRepository {
}
export class RecoveryRepository extends RuntimeRepository {
}
export class SnapshotRepository extends RuntimeRepository {
}
export class ProjectionRepository extends RuntimeRepository {
}
export class ExecutionRepository extends RuntimeRepository {
}
export class QueueRepository extends RuntimeRepository {
}
export class ProviderRepository extends RuntimeRepository {
}
export class PartnerRepository extends RuntimeRepository {
}
export class CredentialRepository extends RuntimeRepository {
}
export class StateRepository extends RuntimeRepository {
}
export class AuditRepository extends RuntimeRepository {
}
export class TimelineRepository extends RuntimeRepository {
}
export class MetricsRepository extends RuntimeRepository {
}
export class HealthRepository extends RuntimeRepository {
}
export class RoyaltyRepository extends RuntimeRepository {
}
export class BootstrapRepository extends RuntimeRepository {
}
export class ValidationRepository extends RuntimeRepository {
}
export function createRuntimeRepository(repository, namespace, name, factory, serializeKey, deserializeKey) {
    return factory(repository, namespace, name, serializeKey, deserializeKey);
}
