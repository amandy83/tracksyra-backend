import type { UniversalMetadataSnapshot, UniversalMetadataTransformerInput, UniversalRelease, UniversalMetadataVersion } from "./metadataTypes";
import { MetadataTransformer } from "./metadataTransformer";
import { MetadataValidator } from "./metadataValidator";
import { UniversalSerializer } from "./metadataSerializer";
import { MetadataHasher } from "./metadataHasher";
import { createMetadataSnapshot } from "./metadataSnapshot";
import type { MetadataLogger } from "./metadataLogger";

export class MetadataBuilder {
  private source: UniversalMetadataTransformerInput | null = null;
  private metadata: Record<string, unknown> = {};

  constructor(
    private readonly transformer: MetadataTransformer,
    private readonly validator: MetadataValidator,
    private readonly serializer: UniversalSerializer,
    private readonly hasher: MetadataHasher,
    private readonly logger: MetadataLogger,
  ) {}

  from(source: UniversalMetadataTransformerInput): this {
    this.source = source;
    return this;
  }

  withMetadata(metadata: Record<string, unknown>): this {
    this.metadata = { ...this.metadata, ...metadata };
    return this;
  }

  reset(): this {
    this.source = null;
    this.metadata = {};
    return this;
  }

  build(): UniversalRelease {
    const source = this.requireSource();
    const release = this.transformer.transform({
      ...source,
      metadata: { ...(source.metadata ?? {}), ...this.metadata },
    });
    const validation = this.validator.validate(release);
    if (!validation.valid) {
      this.logger.error("metadata validation failed", { releaseId: release.id, errors: validation.errors });
      this.validator.assertValid(validation);
    }
    return release;
  }

  buildSnapshot(releaseId?: string): UniversalMetadataSnapshot {
    const release = this.build();
    return createMetadataSnapshot({
      releaseId: releaseId ?? release.id,
      metadata: release,
      version: release.version,
      serializer: this.serializer,
      hasher: this.hasher,
    });
  }

  private requireSource(): UniversalMetadataTransformerInput {
    if (!this.source) throw new Error("MetadataBuilder requires a source before build()");
    return this.source;
  }
}
