import type { PackageFileEntry, PackageResultDocument, PackageVersion } from "./packageTypes";
import { deepFreeze } from "./packageUtils";

export class PackageResult {
  readonly packageId: string;
  readonly releaseId: string;
  readonly version: PackageVersion;
  readonly fingerprint: string;
  readonly checksum: string;
  readonly outputPath: string;
  readonly workspacePath: string;
  readonly manifestPath: string;
  readonly createdAt: Date;
  readonly files: readonly PackageFileEntry[];
  readonly metadata: Readonly<Record<string, unknown>>;

  constructor(input: PackageResultDocument) {
    this.packageId = input.packageId;
    this.releaseId = input.releaseId;
    this.version = input.version;
    this.fingerprint = input.fingerprint;
    this.checksum = input.checksum;
    this.outputPath = input.outputPath;
    this.workspacePath = input.workspacePath;
    this.manifestPath = input.manifestPath;
    this.createdAt = new Date(input.createdAt);
    this.files = Object.freeze([...input.files]);
    this.metadata = deepFreeze({ ...(input.metadata ?? {}) });
    Object.freeze(this);
  }

  toJSON(): PackageResultDocument {
    return deepFreeze({
      packageId: this.packageId,
      releaseId: this.releaseId,
      version: this.version,
      fingerprint: this.fingerprint,
      checksum: this.checksum,
      outputPath: this.outputPath,
      workspacePath: this.workspacePath,
      manifestPath: this.manifestPath,
      createdAt: this.createdAt.toISOString(),
      files: this.files,
      metadata: this.metadata,
    });
  }
}

