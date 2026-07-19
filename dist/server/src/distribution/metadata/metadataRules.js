export const MetadataRules = Object.freeze({
    release: Object.freeze([
        rule("title", "Release title is required", isNonEmptyString),
        rule("primaryArtist", "Primary artist is required when the release is not marked various artists", (value) => value == null || isNonEmptyString(value)),
        rule("label", "Label should be present when provided", (value) => value == null || isNonEmptyString(value)),
        rule("releaseDate", "Release date must be a valid date object when present", (value) => value == null || isValidReleaseDate(value)),
        rule("originalReleaseDate", "Original release date must be a valid date object when present", (value) => value == null || isValidReleaseDate(value)),
        rule("contributors", "Contributor names must be non-empty", (value) => Array.isArray(value) ? value.every(isContributorArrayValid) : true),
        rule("territories", "Territory codes must be non-empty", (value) => Array.isArray(value) ? value.every((territory) => isNonEmptyString(territory.code)) : true),
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
export function validateReleaseShape(release) {
    return runRules(release, MetadataRules.release);
}
export function validateTrackShape(track) {
    return runRules(track, MetadataRules.track);
}
function runRules(value, rules) {
    const errors = [];
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
function rule(path, message, validate, severity = "error") {
    return Object.freeze({ path, message, validate, severity });
}
function readPath(value, path) {
    return path.split(".").reduce((current, segment) => {
        if (!current || typeof current !== "object")
            return undefined;
        return current[segment];
    }, value);
}
function isNonEmptyString(value) {
    return typeof value === "string" && value.trim().length > 0;
}
function isPositiveInteger(value) {
    return typeof value === "number" && Number.isInteger(value) && value > 0;
}
function isValidReleaseDate(value) {
    return Boolean(value && typeof value === "object" && "value" in value && isNonEmptyString(value.value));
}
function isContributorArrayValid(value) {
    if (!value || typeof value !== "object")
        return false;
    const contributor = value;
    return isNonEmptyString(contributor.name) && Array.isArray(contributor.roles);
}
function splitsSumToHundred(value) {
    const splits = value;
    const amounts = splits.map((split) => typeof split.splitPercentage === "number" ? split.splitPercentage : 0);
    const total = amounts.reduce((sum, amount) => sum + amount, 0);
    return Math.abs(total - 100) < 0.01;
}
function hasAudioSignal(value) {
    const audio = value;
    return isNonEmptyString(audio.url) || isNonEmptyString(audio.checksum);
}
function hasArtworkSignal(value) {
    const artwork = value;
    return isNonEmptyString(artwork.url) || isNonEmptyString(artwork.checksum);
}
