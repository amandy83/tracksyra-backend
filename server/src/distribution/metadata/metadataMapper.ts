import type {
  UniversalMetadataAuditRecord,
  UniversalMetadataDiff,
  UniversalMetadataMapperInput,
  UniversalMetadataSnapshot,
  UniversalRelease,
  UniversalTrack,
} from "./metadataTypes";
import { MetadataBuilder } from "./metadataBuilder";
import { MetadataComparator } from "./metadataComparator";
import { MetadataValidator } from "./metadataValidator";
import { UniversalSerializer } from "./metadataSerializer";
import { MetadataHasher } from "./metadataHasher";
import { MetadataAudit } from "./metadataAudit";
import type { MetadataLogger } from "./metadataLogger";

export class UniversalMetadataMapper {
  constructor(
    private readonly builder: MetadataBuilder,
    private readonly comparator: MetadataComparator,
    private readonly validator: MetadataValidator,
    private readonly serializer: UniversalSerializer,
    private readonly hasher: MetadataHasher,
    private readonly logger: MetadataLogger,
    private readonly audit: MetadataAudit,
  ) {}

  map(input: UniversalMetadataMapperInput): UniversalRelease {
    return this.builder.reset().from(input).build();
  }

  mapTrack(input: UniversalMetadataMapperInput, track: UniversalTrack): UniversalTrack {
    const release = this.map(input);
    const built = release.tracks.find((entry) => entry.id === track.id);
    if (!built) throw new Error(`Track not found in mapped release: ${track.id}`);
    return built;
  }

  validate(input: UniversalMetadataMapperInput) {
    return this.validator.validate(this.map(input));
  }

  snapshot(input: UniversalMetadataMapperInput): UniversalMetadataSnapshot {
    return this.builder.reset().from(input).buildSnapshot();
  }

  fingerprint(input: UniversalMetadataMapperInput): string {
    return this.hasher.hash(this.map(input));
  }

  serialize(input: UniversalMetadataMapperInput): string {
    return this.serializer.serialize(this.map(input));
  }

  deserialize(payload: string): UniversalRelease {
    return this.serializer.deserialize(payload);
  }

  diff(before: UniversalRelease, after: UniversalRelease): UniversalMetadataDiff {
    return this.comparator.compare(before, after);
  }

  recordAudit(before: UniversalMetadataSnapshot | null, after: UniversalMetadataSnapshot): MetadataAudit {
    return this.audit.append(before, after);
  }

  auditSnapshot(snapshot: UniversalMetadataSnapshot, previous: UniversalMetadataSnapshot | null = null): MetadataAudit {
    return this.recordAudit(previous, snapshot);
  }

  logValidation(input: UniversalMetadataMapperInput): void {
    const result = this.validate(input);
    if (result.valid) {
      this.logger.info("metadata validation passed", { releaseId: input.release.id, trackCount: input.tracks.length });
      return;
    }
    this.logger.warn("metadata validation issues", { releaseId: input.release.id, errors: result.errors, warnings: result.warnings });
  }
}
