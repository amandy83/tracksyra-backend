import type {
  UniversalRelease,
  UniversalTrack,
  UniversalValidationError,
  UniversalValidationResult,
} from "./metadataTypes";
import { validateReleaseShape, validateTrackShape } from "./metadataRules";

export type MetadataValidatorOptions = Readonly<{
  allowWarningsAsErrors?: boolean;
}>;

export class MetadataValidator {
  constructor(private readonly options: MetadataValidatorOptions = {}) {}

  validateRelease(release: UniversalRelease): UniversalValidationResult {
    const errors = validateReleaseShape(release);
    return this.toResult(errors, { version: release.version, id: release.id });
  }

  validateTrack(track: UniversalTrack): UniversalValidationResult {
    const errors = validateTrackShape(track);
    return this.toResult(errors, { trackId: track.id });
  }

  validate(release: UniversalRelease): UniversalValidationResult {
    const releaseResult = this.validateRelease(release);
    const trackResults = release.tracks.map((track) => this.validateTrack(track));
    const errors = [...releaseResult.errors, ...trackResults.flatMap((result) => result.errors)];
    const warnings = [...releaseResult.warnings, ...trackResults.flatMap((result) => result.warnings)];
    return this.toResult([...errors, ...warnings.filter((warning) => this.options.allowWarningsAsErrors)], {
      releaseId: release.id,
      trackCount: release.tracks.length,
    });
  }

  assertValid(result: UniversalValidationResult): void {
    if (result.valid) return;
    const message = result.errors.map((entry) => `${entry.path}: ${entry.message}`).join("; ");
    throw new Error(message || "Metadata validation failed");
  }

  private toResult(errors: readonly UniversalValidationError[], metadata: Record<string, unknown> = {}): UniversalValidationResult {
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

