import type {
  UniversalMetadataAuditRecord,
  UniversalMetadataDiff,
  UniversalMetadataSnapshot,
} from "./metadataTypes";
import { MetadataComparator } from "./metadataComparator";

export class MetadataAudit {
  constructor(
    private readonly comparator: MetadataComparator,
    private readonly records: readonly UniversalMetadataAuditRecord[] = [],
  ) {}

  get history(): readonly UniversalMetadataAuditRecord[] {
    return this.records;
  }

  latest(): UniversalMetadataAuditRecord | null {
    return this.records[this.records.length - 1] ?? null;
  }

  record(snapshot: UniversalMetadataSnapshot, diff: UniversalMetadataDiff | null = null): MetadataAudit {
    return new MetadataAudit(this.comparator, [
      ...this.records,
      Object.freeze({
        id: `audit_${snapshot.id}`,
        releaseId: snapshot.releaseId,
        snapshotId: snapshot.id,
        fingerprint: snapshot.fingerprint,
        createdAt: new Date(),
        diff,
        metadata: Object.freeze({ version: snapshot.version, trackCount: snapshot.trackCount }),
      }),
    ]);
  }

  compareSnapshots(before: UniversalMetadataSnapshot, after: UniversalMetadataSnapshot): UniversalMetadataDiff {
    return this.comparator.compare(before.metadata, after.metadata);
  }

  append(before: UniversalMetadataSnapshot | null, after: UniversalMetadataSnapshot): MetadataAudit {
    const diff = before ? this.compareSnapshots(before, after) : null;
    return this.record(after, diff);
  }
}
