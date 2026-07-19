import type { PackageManifestDocument, PackageSnapshotDocument } from "./packageTypes";
import { deepFreeze } from "./packageUtils";

export class PackageSnapshot {
  readonly id: string;
  readonly version: PackageSnapshotDocument["version"];
  readonly packageId: string;
  readonly releaseId: string;
  readonly fingerprint: string;
  readonly createdAt: Date;
  readonly serialized: string;
  readonly manifest: PackageManifestDocument;
  readonly metadata: Readonly<Record<string, unknown>>;

  constructor(input: PackageSnapshotDocument) {
    this.id = input.id;
    this.version = input.version;
    this.packageId = input.packageId;
    this.releaseId = input.releaseId;
    this.fingerprint = input.fingerprint;
    this.createdAt = new Date(input.createdAt);
    this.serialized = input.serialized;
    this.manifest = deepFreeze({ ...input.manifest });
    this.metadata = deepFreeze({ ...(input.metadata ?? {}) });
    Object.freeze(this);
  }
}
