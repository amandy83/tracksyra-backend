import { validateReleaseShape, validateTrackShape } from "./metadataRules.js";
export class MetadataValidator {
    options;
    constructor(options = {}) {
        this.options = options;
    }
    validateRelease(release) {
        const errors = validateReleaseShape(release);
        return this.toResult(errors, { version: release.version, id: release.id });
    }
    validateTrack(track) {
        const errors = validateTrackShape(track);
        return this.toResult(errors, { trackId: track.id });
    }
    validate(release) {
        const releaseResult = this.validateRelease(release);
        const trackResults = release.tracks.map((track) => this.validateTrack(track));
        const errors = [...releaseResult.errors, ...trackResults.flatMap((result) => result.errors)];
        const warnings = [...releaseResult.warnings, ...trackResults.flatMap((result) => result.warnings)];
        return this.toResult([...errors, ...warnings.filter((warning) => this.options.allowWarningsAsErrors)], {
            releaseId: release.id,
            trackCount: release.tracks.length,
        });
    }
    assertValid(result) {
        if (result.valid)
            return;
        const message = result.errors.map((entry) => `${entry.path}: ${entry.message}`).join("; ");
        throw new Error(message || "Metadata validation failed");
    }
    toResult(errors, metadata = {}) {
        const normalizedErrors = Object.freeze([...errors.filter((error) => error.severity === "error")]);
        const normalizedWarnings = Object.freeze([...errors.filter((error) => error.severity === "warning")]);
        return Object.freeze({
            valid: normalizedErrors.length === 0,
            errors: normalizedErrors,
            warnings: normalizedWarnings,
            metadata: Object.freeze({ ...metadata }),
        });
    }
}
