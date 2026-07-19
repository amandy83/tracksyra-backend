import { mkdir, readFile, writeFile, rename, rm, access } from "node:fs/promises";
import { dirname, join } from "node:path";

export interface DocumentStore {
  read<T>(key: string): Promise<T | null>;
  write<T>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
}

export class FileDocumentStore implements DocumentStore {
  constructor(private readonly basePath: string) {}

  async read<T>(key: string): Promise<T | null> {
    const path = this.pathFor(key);
    try {
      const payload = await readFile(path, "utf8");
      return JSON.parse(payload) as T;
    } catch {
      return null;
    }
  }

  async write<T>(key: string, value: T): Promise<void> {
    const path = this.pathFor(key);
    await mkdir(dirname(path), { recursive: true });
    const tempPath = `${path}.tmp`;
    await writeFile(tempPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
    await rename(tempPath, path);
  }

  async delete(key: string): Promise<void> {
    await rm(this.pathFor(key), { force: true });
  }

  async exists(key: string): Promise<boolean> {
    try {
      await access(this.pathFor(key));
      return true;
    } catch {
      return false;
    }
  }

  private pathFor(key: string): string {
    const normalized = key.replace(/\\/g, "/").replace(/^\/+/, "");
    return join(this.basePath, normalized);
  }
}

