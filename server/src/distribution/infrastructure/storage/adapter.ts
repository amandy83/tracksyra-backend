import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import type { StorageConsistencyState, StorageEnvelope, StorageMetadata } from "./storageTypes";

export interface StorageAdapter {
  read<TValue>(key: string): StorageEnvelope<TValue> | null;
  write<TValue>(key: string, envelope: StorageEnvelope<TValue>): void;
  delete(key: string): void;
  exists(key: string): boolean;
  compareAndSwap<TValue>(key: string, expectedVersion: number, next: StorageEnvelope<TValue>): boolean;
  list(prefix?: string): readonly string[];
  health(): StorageConsistencyState;
}

function normalizeKey(key: string): string {
  return key.replace(/\\/g, "/").replace(/^\/+/, "");
}

function hashKey(key: string): string {
  return createHash("sha256").update(key, "utf8").digest("hex");
}

function resolvePath(basePath: string, key: string): string {
  return join(basePath, normalizeKey(key));
}

function readEnvelope<TValue>(path: string): StorageEnvelope<TValue> | null {
  if (!existsSync(path)) return null;
  try {
    const payload = readFileSync(path, "utf8");
    return JSON.parse(payload) as StorageEnvelope<TValue>;
  } catch {
    return null;
  }
}

export class FileStorageAdapter implements StorageAdapter {
  constructor(private readonly basePath: string) {}

  read<TValue>(key: string): StorageEnvelope<TValue> | null {
    return readEnvelope<TValue>(resolvePath(this.basePath, key));
  }

  write<TValue>(key: string, envelope: StorageEnvelope<TValue>): void {
    const path = resolvePath(this.basePath, key);
    mkdirSync(dirname(path), { recursive: true });
    const tempPath = `${path}.tmp`;
    writeFileSync(tempPath, `${JSON.stringify(envelope, null, 2)}\n`, "utf8");
    renameSync(tempPath, path);
  }

  delete(key: string): void {
    rmSync(resolvePath(this.basePath, key), { force: true });
  }

  exists(key: string): boolean {
    return existsSync(resolvePath(this.basePath, key));
  }

  compareAndSwap<TValue>(key: string, expectedVersion: number, next: StorageEnvelope<TValue>): boolean {
    const current = this.read<TValue>(key);
    if ((current?.version ?? 0) !== expectedVersion) return false;
    this.write(key, next);
    return true;
  }

  list(prefix = ""): readonly string[] {
    const root = resolvePath(this.basePath, prefix || ".");
    return Object.freeze([root]);
  }

  health(): StorageConsistencyState {
    return "consistent";
  }
}

export function storageKey(namespace: string, name: string): string {
  return `storage/${normalizeKey(namespace)}/${hashKey(name)}.json`;
}

export function createStorageMetadata(metadata: StorageMetadata = {}): StorageMetadata {
  return Object.freeze({ ...metadata });
}
