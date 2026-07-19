import type {
  UniversalRelease,
  UniversalTrack,
  UniversalValidationError,
} from "./metadataTypes";

export type MetadataRule = Readonly<{
  path: string;
  message: string;
  severity: "error" | "warning";
  validate: (value: unknown) => boolean;
}>;

export type MetadataRuleSet = Readonly<{
  release: readonly MetadataRule[];
  track: readonly MetadataRule[];
}>;

export const MetadataRules: MetadataRuleSet = Object.freeze({
  release: Object.freeze([
    rule("title", "Release title is required", isNonEmptyString),
    rule("primaryArtist", "Primary artist is required when the release is not marked various artists", (value) => value == null || isNonEmptyString(value)),
    rule("label", "Label should be present when provided", (value) => value == null || isNonEmptyString(value)),
    rule("releaseDate", "Release date must be a valid date object when present", (value) => value == null || isValidReleaseDate(value)),
    rule("originalReleaseDate", "Original release date must be a valid date object when present", (value) => value == null || isValidReleaseDate(value)),
    rule("contributors", "Contributor names must be non-empty", (value) => Array.isArray(value) ? value.every(isContributorArrayValid) : true),
    rule("territories", "Territory codes must be non-empty", (value) => Array.isArray(value) ? value.every((territory) => isNonEmptyString((territory as { code?: unknown }).code)) : true),
  ]),
  track: Object.freeze([
    rule("title", "Track title is required", isNonEmptyString),
    rule("trackNumber", "Track number must be a positive integer", isPositiveInteger),
    rule("discNumber", "Disc number must be a positive integer", isPositiveInteger),
    rule("contributors", "Track contributors must have valid names", (value) => Array.isArray(value) ? value.every(isContributorArrayValid) : true),
    rule("publishing.splits", "Publishing splits must sum to 100 when present", (value) => !Array.isArray(value) || splitsSumToHundred(value)),
    rule("audio", "Audio must include at least a url or checksum when present", (value) => value == null || hasAudioSignal(value)),
    rule("artwork", "Artwork must include at least a url or checksum when present", (value) => value == null || hasArtworkSignal(value)),
  ]),
});

export function validateReleaseShape(release: UniversalRelease): UniversalValidationError[] {
  return runRules(release, MetadataRules.release);
}

export function validateTrackShape(track: UniversalTrack): UniversalValidationError[] {
  return runRules(track, MetadataRules.track);
}

function runRules(value: Record<string, unknown>, rules: readonly MetadataRule[]): UniversalValidationError[] {
  const errors: UniversalValidationError[] = [];
  for (const rule of rules) {
    const current = readPath(value, rule.path);
    if (!rule.validate(current)) {
      errors.push({
        path: rule.path,
        code: "VALIDATION_FAILED",
        message: rule.message,
        severity: rule.severity,
        value: current,
      });
    }
  }
  return errors;
}

function rule(path: string, message: string, validate: (value: unknown) => boolean, severity: "error" | "warning" = "error"): MetadataRule {
  return Object.freeze({ path, message, validate, severity });
}

function readPath(value: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((current, segment) => {
    if (!current || typeof current !== "object") return undefined;
    return (current as Record<string, unknown>)[segment];
  }, value);
}

function isNonEmptyString(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function isPositiveInteger(value: unknown): boolean {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function isValidReleaseDate(value: unknown): boolean {
  return Boolean(value && typeof value === "object" && "value" in value && isNonEmptyString((value as { value?: unknown }).value));
}

function isContributorArrayValid(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const contributor = value as { name?: unknown; roles?: unknown };
  return isNonEmptyString(contributor.name) && Array.isArray(contributor.roles);
}

function splitsSumToHundred(value: unknown): boolean {
  const splits = value as Array<{ splitPercentage?: unknown }>;
  const amounts = splits.map((split) => typeof split.splitPercentage === "number" ? split.splitPercentage : 0);
  const total = amounts.reduce((sum, amount) => sum + amount, 0);
  return Math.abs(total - 100) < 0.01;
}

function hasAudioSignal(value: unknown): boolean {
  const audio = value as { url?: unknown; checksum?: unknown };
  return isNonEmptyString(audio.url) || isNonEmptyString(audio.checksum);
}

function hasArtworkSignal(value: unknown): boolean {
  const artwork = value as { url?: unknown; checksum?: unknown };
  return isNonEmptyString(artwork.url) || isNonEmptyString(artwork.checksum);
}

