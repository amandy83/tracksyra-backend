import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, readFile, writeFile, rename, rm } from "node:fs/promises";
import { dirname, join } from "node:path";

export interface ArtifactStorage {
  read(path: string): Promise<Buffer | null>;
  write(path: string, content: Buffer | string): Promise<void>;
}

export interface PackageStorage extends ArtifactStorage {
  exists(path: string): Promise<boolean>;
  remove(path: string): Promise<void>;
}

export type ManifestStorage = ArtifactStorage;
export type AuditStorage = ArtifactStorage;

class FileStorage implements ArtifactStorage {
  constructor(private readonly basePath: string) {}

  async read(path: string): Promise<Buffer | null> {
    try {
      return await readFile(this.resolve(path));
    } catch {
      return null;
    }
  }

  async write(path: string, content: Buffer | string): Promise<void> {
    const resolved = this.resolve(path);
    await mkdir(dirname(resolved), { recursive: true });
    const tempPath = `${resolved}.tmp`;
    await writeFile(tempPath, content);
    await rename(tempPath, resolved);
  }

  protected resolve(path: string): string {
    return join(this.basePath, path.replace(/\\/g, "/").replace(/^\/+/, ""));
  }
}

export class FilePackageStorage extends FileStorage implements PackageStorage {
  async exists(path: string): Promise<boolean> {
    try {
      await readFile(this.resolve(path));
      return true;
    } catch {
      return false;
    }
  }

  async remove(path: string): Promise<void> {
    await rm(this.resolve(path), { force: true });
  }
}

export class FileArtifactStorage extends FileStorage implements ArtifactStorage {}
export class FileManifestStorage extends FileStorage implements ManifestStorage {}
export class FileAuditStorage extends FileStorage implements AuditStorage {}
