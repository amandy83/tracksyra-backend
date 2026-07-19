import { createHash } from "node:crypto";
import { storageKey } from "../storage/adapter.js";
function nowIso() {
    return new Date().toISOString();
}
function freezeEntries(entries) {
    return Object.freeze([...entries].map(([entryKey, value]) => [entryKey, value]));
}
function hashKey(key) {
    return createHash("sha256").update(key, "utf8").digest("hex");
}
function freezeEnvelope(envelope) {
    return Object.freeze({
        version: envelope.version,
        updatedAt: envelope.updatedAt,
        entries: freezeEntries(envelope.entries),
    });
}
export class PersistentMap {
    key;
    serializeKey;
    deserializeKey;
    repository;
    cache = new Map();
    version = 0;
    loaded = false;
    constructor(repository, key, serializeKey = (value) => String(value), deserializeKey = (value) => value) {
        this.key = key;
        this.serializeKey = serializeKey;
        this.deserializeKey = deserializeKey;
        this.repository = repository;
    }
    ensureLoaded() {
        if (this.loaded)
            return;
        const envelope = this.repository.find(this.key);
        if (envelope?.value) {
            this.version = envelope.version;
            this.cache = new Map(envelope.value.entries);
        }
        this.loaded = true;
    }
    persist() {
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
    keyOf(key) {
        return this.serializeKey(key);
    }
    get(key) {
        this.ensureLoaded();
        return this.cache.get(this.keyOf(key));
    }
    set(key, value) {
        this.ensureLoaded();
        this.cache.set(this.keyOf(key), value);
        this.persist();
        return this;
    }
    has(key) {
        this.ensureLoaded();
        return this.cache.has(this.keyOf(key));
    }
    delete(key) {
        this.ensureLoaded();
        const result = this.cache.delete(this.keyOf(key));
        if (result) {
            this.persist();
        }
        return result;
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
        return freezeEnvelope({
            version: this.version,
            updatedAt: nowIso(),
            entries: freezeEntries(this.cache.entries()),
        });
    }
    get size() {
        this.ensureLoaded();
        return this.cache.size;
    }
    [Symbol.iterator]() {
        this.ensureLoaded();
        return this.entries().map((entry) => [...entry])[Symbol.iterator]();
    }
}
export function createPersistentMapKey(namespace, name) {
    return storageKey(`persistent/${namespace}`, hashKey(name));
}
