export class UniversalMetadataMapper {
    builder;
    comparator;
    validator;
    serializer;
    hasher;
    logger;
    audit;
    constructor(builder, comparator, validator, serializer, hasher, logger, audit) {
        this.builder = builder;
        this.comparator = comparator;
        this.validator = validator;
        this.serializer = serializer;
        this.hasher = hasher;
        this.logger = logger;
        this.audit = audit;
    }
    map(input) {
        return this.builder.reset().from(input).build();
    }
    mapTrack(input, track) {
        const release = this.map(input);
        const built = release.tracks.find((entry) => entry.id === track.id);
        if (!built)
            throw new Error(`Track not found in mapped release: ${track.id}`);
        return built;
    }
    validate(input) {
        return this.validator.validate(this.map(input));
    }
    snapshot(input) {
        return this.builder.reset().from(input).buildSnapshot();
    }
    fingerprint(input) {
        return this.hasher.hash(this.map(input));
    }
    serialize(input) {
        return this.serializer.serialize(this.map(input));
    }
    deserialize(payload) {
        return this.serializer.deserialize(payload);
    }
    diff(before, after) {
        return this.comparator.compare(before, after);
    }
    recordAudit(before, after) {
        return this.audit.append(before, after);
    }
    auditSnapshot(snapshot, previous = null) {
        return this.recordAudit(previous, snapshot);
    }
    logValidation(input) {
        const result = this.validate(input);
        if (result.valid) {
            this.logger.info("metadata validation passed", { releaseId: input.release.id, trackCount: input.tracks.length });
            return;
        }
        this.logger.warn("metadata validation issues", { releaseId: input.release.id, errors: result.errors, warnings: result.warnings });
    }
}
