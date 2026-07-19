import { MetadataNormalizer } from "./metadataNormalizer.js";
export class MetadataDefaults {
    normalizer;
    defaultLanguage;
    defaultLanguageName;
    defaultReleaseKind;
    defaultAdvisory;
    defaultTerritories;
    constructor(normalizer = new MetadataNormalizer(), options = {}) {
        this.normalizer = normalizer;
        this.defaultLanguage = options.defaultLanguage ?? "und";
        this.defaultLanguageName = options.defaultLanguageName ?? null;
        this.defaultReleaseKind = options.defaultReleaseKind ?? "album";
        this.defaultAdvisory = options.defaultAdvisory ?? "none";
        this.defaultTerritories = Object.freeze([...(options.defaultTerritories ?? [])]);
    }
    language(input, name) {
        return this.normalizer.language(input, this.defaultLanguage, name ?? this.defaultLanguageName);
    }
    releaseKind(trackCount, variousArtists, explicit, podcast = false, audiobook = false, instrumental = false, compilation = false, multiDisc = false) {
        if (podcast)
            return "podcast";
        if (audiobook)
            return "audiobook";
        if (compilation || variousArtists)
            return "compilation";
        if (multiDisc)
            return "multi_disc";
        if (instrumental)
            return "instrumental";
        if (trackCount <= 1)
            return "single";
        if (trackCount <= 6)
            return "ep";
        if (explicit && trackCount === 1)
            return "single";
        return this.defaultReleaseKind;
    }
    advisory(explicit, clean, value) {
        if (value)
            return this.normalizer.advisory(value, explicit, clean);
        if (explicit)
            return "explicit";
        if (clean)
            return "clean";
        return this.defaultAdvisory;
    }
    releaseDate(kind, input) {
        return this.normalizer.date(input ?? null, kind);
    }
    territories() {
        return this.defaultTerritories;
    }
}
