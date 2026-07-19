import { createMetadataSnapshot } from "./metadataSnapshot.js";
export class MetadataBuilder {
    transformer;
    validator;
    serializer;
    hasher;
    logger;
    source = null;
    metadata = {};
    constructor(transformer, validator, serializer, hasher, logger) {
        this.transformer = transformer;
        this.validator = validator;
        this.serializer = serializer;
        this.hasher = hasher;
        this.logger = logger;
    }
    from(source) {
        this.source = source;
        return this;
    }
    withMetadata(metadata) {
        this.metadata = { ...this.metadata, ...metadata };
        return this;
    }
    reset() {
        this.source = null;
        this.metadata = {};
        return this;
    }
    build() {
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
    buildSnapshot(releaseId) {
        const release = this.build();
        return createMetadataSnapshot({
            releaseId: releaseId ?? release.id,
            metadata: release,
            version: release.version,
            serializer: this.serializer,
            hasher: this.hasher,
        });
    }
    requireSource() {
        if (!this.source)
            throw new Error("MetadataBuilder requires a source before build()");
        return this.source;
    }
}
