const LANGUAGE_IDS = {
    english: 1,
    hindi: 2,
    punjabi: 3,
    tamil: 4,
    telugu: 5,
    spanish: 6,
};
const MUSIC_STYLE_IDS = {
    pop: 60,
    "hip-hop": 71,
    hiphop: 71,
    "r&b": 15,
    rock: 21,
    electronic: 42,
    indie: 85,
    bollywood: 91,
    punjabi: 92,
    classical: 31,
    jazz: 32,
    folk: 33,
};
export function mapLanguageToProviderId(language) {
    return LANGUAGE_IDS[normalize(language)] ?? LANGUAGE_IDS.english;
}
export function mapGenreToProviderStyleId(genre) {
    return MUSIC_STYLE_IDS[normalize(genre)] ?? MUSIC_STYLE_IDS.pop;
}
export function splitFeaturedArtists(value) {
    if (Array.isArray(value))
        return value.map((item) => item.trim()).filter(Boolean);
    if (!value)
        return [];
    return value.split(",").map((item) => item.trim()).filter(Boolean);
}
function normalize(value) {
    return String(value ?? "").trim().toLowerCase();
}
