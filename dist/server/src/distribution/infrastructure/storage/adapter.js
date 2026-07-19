import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
function normalizeKey(key) {
    return key.replace(/\\/g, "/").replace(/^\/+/, "");
}
function hashKey(key) {
    return createHash("sha256").update(key, "utf8").digest("hex");
}
function resolvePath(basePath, key) {
    return join(basePath, normalizeKey(key));
}
function readEnvelope(path) {
    if (!existsSync(path))
        return null;
    try {
        const payload = readFileSync(path, "utf8");
        return JSON.parse(payload);
    }
    catch {
        return null;
    }
}
export class FileStorageAdapter {
    basePath;
    constructor(basePath) {
        this.basePath = basePath;
    }
    read(key) {
        return readEnvelope(resolvePath(this.basePath, key));
    }
    write(key, envelope) {
        const path = resolvePath(this.basePath, key);
        mkdirSync(dirname(path), { recursive: true });
        const tempPath = `${path}.tmp`;
        writeFileSync(tempPath, `${JSON.stringify(envelope, null, 2)}\n`, "utf8");
        renameSync(tempPath, path);
    }
    delete(key) {
        rmSync(resolvePath(this.basePath, key), { force: true });
    }
    exists(key) {
        return existsSync(resolvePath(this.basePath, key));
    }
    compareAndSwap(key, expectedVersion, next) {
        const current = this.read(key);
        if ((current?.version ?? 0) !== expectedVersion)
            return false;
        this.write(key, next);
        return true;
    }
    list(prefix = "") {
        const root = resolvePath(this.basePath, prefix || ".");
        return Object.freeze([root]);
    }
    health() {
        return "consistent";
    }
}
export function storageKey(namespace, name) {
    return `storage/${normalizeKey(namespace)}/${hashKey(name)}.json`;
}
export function createStorageMetadata(metadata = {}) {
    return Object.freeze({ ...metadata });
}
