export const UNIVERSAL_METADATA_VERSIONS = ["1.0"];
export function isUniversalContributor(value) {
    return Boolean(value && typeof value === "object" && "name" in value && "roles" in value);
}
export function isUniversalTrack(value) {
    return Boolean(value && typeof value === "object" && "id" in value && "title" in value && "trackNumber" in value);
}
export function isUniversalRelease(value) {
    return Boolean(value && typeof value === "object" && "id" in value && "tracks" in value && "version" in value);
}
export function cloneParticipant(participant) {
    return {
        name: participant.name,
        roles: participant.role,
        splitPercentage: null,
        ipi: null,
        isPrimary: false,
        metadata: {},
    };
}
