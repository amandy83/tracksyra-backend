import type { UniversalMetadataSnapshot, UniversalMetadataVersion, UniversalRelease } from "./metadataTypes";
import { MetadataHasher } from "./metadataHasher";
import { UniversalSerializer } from "./metadataSerializer";

export type MetadataSnapshotInput = Readonly<{
  releaseId: string;
  metadata: UniversalRelease;
  version?: UniversalMetadataVersion;
  serializer: UniversalSerializer;
  hasher: MetadataHasher;
}>;

export function createMetadataSnapshot(input: MetadataSnapshotInput): UniversalMetadataSnapshot {
  const serialized = input.serializer.serialize(input.metadata);
  const fingerprint = input.hasher.hash(input.metadata);
  return Object.freeze({
    id: `snapshot_${input.releaseId}_${fingerprint.slice(0, 12)}`,
    version: input.version ?? input.metadata.version,
    releaseId: input.releaseId,
    trackCount: input.metadata.tracks.length,
    fingerprint,
    createdAt: new Date(),
    serialized,
    metadata: input.metadata,
  });
}
