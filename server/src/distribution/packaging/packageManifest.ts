import type { PackageFileEntry, PackageManifestDocument, PackageVersion } from "./packageTypes";
import { deepFreeze } from "./packageUtils";

export class PackageManifest {
  readonly version: PackageVersion;
  readonly packageId: string;
  readonly releaseId: string;
  readonly fingerprint: string;
  readonly createdAt: Date;
  readonly files: readonly PackageFileEntry[];
  readonly metadata: Readonly<Record<string, unknown>>;

  constructor(input: PackageManifestDocument) {
    this.version = input.version;
    this.packageId = input.packageId;
    this.releaseId = input.releaseId;
    this.fingerprint = input.fingerprint;
    this.createdAt = new Date(input.createdAt);
    this.files = Object.freeze([...input.files]);
    this.metadata = deepFreeze({ ...(input.metadata ?? {}) });
    Object.freeze(this);
  }

  static create(input: Omit<PackageManifestDocument, "createdAt"> & Readonly<{ createdAt?: string }>): PackageManifest {
    return new PackageManifest({
      ...input,
      createdAt: input.createdAt ?? new Date().toISOString(),
    });
  }

  toJSON(): PackageManifestDocument {
    return deepFreeze({
      version: this.version,
      packageId: this.packageId,
      releaseId: this.releaseId,
      fingerprint: this.fingerprint,
      createdAt: this.createdAt.toISOString(),
      files: this.files,
      metadata: this.metadata,
    });
  }

  withFiles(files: readonly PackageFileEntry[]): PackageManifest {
    return new PackageManifest({
      ...this.toJSON(),
      files,
    });
  }
}

