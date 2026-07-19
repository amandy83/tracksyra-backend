import type { PackageAuditDocument, PackageDiffDocument, PackageSnapshotDocument } from "./packageTypes";
import { deepFreeze } from "./packageUtils";

export class PackageAudit {
  private readonly history: PackageAuditDocument[] = [];

  append(before: PackageSnapshotDocument | null, after: PackageSnapshotDocument, diff: PackageDiffDocument | null = null): this {
    this.history.push(deepFreeze({
      id: after.id,
      packageId: after.packageId,
      releaseId: after.releaseId,
      snapshotId: after.id,
      fingerprint: after.fingerprint,
      createdAt: after.createdAt,
      diff,
      metadata: Object.freeze({ before: before?.id ?? null }),
    }));
    return this;
  }

  values(): readonly PackageAuditDocument[] {
    return Object.freeze([...this.history]);
  }
}

