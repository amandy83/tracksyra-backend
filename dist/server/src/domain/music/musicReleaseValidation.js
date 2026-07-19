export function validateMusicRelease(release) {
    const errors = [];
    if (!release.id)
        errors.push("MusicRelease.id is required");
    if (!release.title?.trim())
        errors.push("MusicRelease.title is required");
    if (!release.artistId)
        errors.push("MusicRelease.artistId is required");
    if (!release.primaryArtistName?.trim())
        errors.push("MusicRelease.primaryArtistName is required");
    if (release.artistMode === "existing" && !hasLinkedArtistIdentity(release.spotifyArtistId, release.appleArtistId)) {
        errors.push("MusicRelease existing release artist requires a Spotify or Apple artist id");
    }
    if (!release.genre?.trim())
        errors.push("MusicRelease.genre is required");
    if (!release.language?.trim())
        errors.push("MusicRelease.language is required");
    if (!release.audioFiles.length)
        errors.push("MusicRelease requires at least one audio file");
    release.audioFiles.forEach((audio, index) => {
        if (!audio.trackId)
            errors.push(`audioFiles[${index}].trackId is required`);
        if (!audio.title?.trim())
            errors.push(`audioFiles[${index}].title is required`);
        if (!audio.primaryArtistName?.trim())
            errors.push(`audioFiles[${index}].primaryArtistName is required`);
        if (audio.artistMode === "existing" && !hasLinkedArtistIdentity(audio.spotifyArtistId, audio.appleArtistId)) {
            errors.push(`audioFiles[${index}] existing artist requires a Spotify or Apple artist id`);
        }
    });
    return errors.length ? { ok: false, errors } : { ok: true, release };
}
function hasLinkedArtistIdentity(spotifyArtistId, appleArtistId) {
    return Boolean((spotifyArtistId || "").trim() || (appleArtistId || "").trim());
}
