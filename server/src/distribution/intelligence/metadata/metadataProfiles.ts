import type { MetadataDspName, MetadataDspProfile } from "./metadataIntelligenceTypes";

const DEFAULT_RELEASE_KINDS: readonly MetadataDspProfile["supportedReleaseKinds"][number][] = ["single", "ep", "album", "compilation", "multi_disc", "instrumental"];

const baseRuleSet = Object.freeze({
  titleRules: Object.freeze(["trim", "collapse_spaces", "remove_hidden_characters", "normalize_unicode"]),
  subtitleRules: Object.freeze(["trim", "normalize_unicode"]),
  versionRules: Object.freeze(["trim", "normalize_version_tokens"]),
  artistRules: Object.freeze(["trim", "dedupe", "normalize_unicode"]),
  featuredArtistRules: Object.freeze(["trim", "dedupe", "normalize_unicode"]),
  albumRules: Object.freeze(["trim", "title_case"]),
  languageRules: Object.freeze(["normalize_language_code"]),
  genreRules: Object.freeze(["map_to_canonical_genre"]),
  moodRules: Object.freeze(["infer_mood"]),
  copyrightRules: Object.freeze(["normalize_line"]),
  publishingRules: Object.freeze(["dedupe_publishers", "dedupe_writers"]),
  artworkRules: Object.freeze(["require_square", "jpeg_png_only"]),
  lyricsRules: Object.freeze(["trim", "normalize_unicode"]),
  explicitContentRules: Object.freeze(["normalize_explicit_flag"]),
  releaseDateRules: Object.freeze(["iso_date"]),
  territoryRules: Object.freeze(["uppercase", "dedupe"]),
  identifierRules: Object.freeze(["validate_isrc", "validate_upc", "validate_iswc", "validate_ipi", "validate_isni"]),
  deliveryRules: Object.freeze(["release_title", "artist", "identifiers", "territories"]),
});

function createProfile(platform: MetadataDspName, input: Partial<MetadataDspProfile> & Pick<MetadataDspProfile, "platform" | "displayName">): MetadataDspProfile {
  return Object.freeze({
    platform,
    displayName: input.displayName,
    titleCase: input.titleCase ?? true,
    preserveSubtitleCase: input.preserveSubtitleCase ?? false,
    allowFeaturingInTitle: input.allowFeaturingInTitle ?? false,
    allowEmoji: input.allowEmoji ?? false,
    maxTitleLength: input.maxTitleLength ?? 150,
    maxSubtitleLength: input.maxSubtitleLength ?? 100,
    maxArtistLength: input.maxArtistLength ?? 150,
    maxGenreLength: input.maxGenreLength ?? 80,
    identifierRequirements: Object.freeze(input.identifierRequirements ?? ["ISRC", "UPC", "Label", "Artist"]),
    supportedReleaseKinds: Object.freeze(input.supportedReleaseKinds ?? DEFAULT_RELEASE_KINDS),
    supportedLanguages: Object.freeze(input.supportedLanguages ?? ["en", "es", "fr", "de", "pt", "ja"]),
    supportedTerritories: Object.freeze(input.supportedTerritories ?? ["WORLD", "US", "CA", "GB", "EU", "IN", "JP", "AU", "BR"]),
    genreMap: Object.freeze(input.genreMap ?? {
      hiphop: "Hip-Hop/Rap",
      rnb: "R&B/Soul",
      electronic: "Electronic",
      pop: "Pop",
      rock: "Rock",
    }),
    moodMap: Object.freeze(input.moodMap ?? {
      energetic: "Energetic",
      chill: "Chill",
      sad: "Melancholic",
      aggressive: "Intense",
      romantic: "Romantic",
    }),
    ruleSet: input.ruleSet ?? baseRuleSet,
    deliveryHints: Object.freeze(input.deliveryHints ?? ["title", "artist", "identifiers", "territories", "artwork"]),
    metadata: Object.freeze(input.metadata ?? {}),
  });
}

export const METADATA_DSP_PROFILES: Readonly<Record<MetadataDspName, MetadataDspProfile>> = Object.freeze({
  spotify: createProfile("spotify", { platform: "spotify", displayName: "Spotify", allowFeaturingInTitle: true, identifierRequirements: ["ISRC", "UPC", "Artist", "Label"], deliveryHints: ["title", "artist", "territories", "lyrics", "identifier"] }),
  apple_music: createProfile("apple_music", { platform: "apple_music", displayName: "Apple Music", titleCase: true, preserveSubtitleCase: true, identifierRequirements: ["ISRC", "UPC", "ISWC", "Artist", "Label"], supportedLanguages: ["en", "es", "fr", "de", "it", "pt", "ja"], deliveryHints: ["title", "subtitles", "identifiers", "artwork", "publishing"] }),
  youtube_music: createProfile("youtube_music", { platform: "youtube_music", displayName: "YouTube Music", allowFeaturingInTitle: true, supportedReleaseKinds: ["single", "ep", "album", "compilation", "multi_disc", "instrumental", "podcast"], deliveryHints: ["title", "artist", "artwork", "lyrics", "territories"] }),
  amazon_music: createProfile("amazon_music", { platform: "amazon_music", displayName: "Amazon Music", identifierRequirements: ["ISRC", "UPC", "ISWC", "IPI", "Artist", "Label"], supportedTerritories: ["WORLD", "US", "CA", "GB", "EU", "IN", "JP", "AU", "BR", "MX"], deliveryHints: ["title", "artist", "copyright", "publishing", "artwork"] }),
  deezer: createProfile("deezer", { platform: "deezer", displayName: "Deezer", allowFeaturingInTitle: true, supportedLanguages: ["en", "fr", "es", "de", "pt", "it"], deliveryHints: ["title", "artist", "lyrics", "explicit", "territories"] }),
  tidal: createProfile("tidal", { platform: "tidal", displayName: "TIDAL", preserveSubtitleCase: true, supportedReleaseKinds: ["single", "ep", "album", "compilation", "multi_disc", "instrumental"], deliveryHints: ["title", "artist", "artwork", "identifiers", "publishing"] }),
  tiktok: createProfile("tiktok", { platform: "tiktok", displayName: "TikTok", titleCase: false, allowFeaturingInTitle: false, allowEmoji: false, identifierRequirements: ["ISRC", "UPC", "Artist"], supportedReleaseKinds: ["single", "ep", "album"], deliveryHints: ["title", "artist", "short_title", "territories"] }),
  meta: createProfile("meta", { platform: "meta", displayName: "Meta", titleCase: true, allowFeaturingInTitle: false, supportedReleaseKinds: ["single", "ep", "album", "compilation"], deliveryHints: ["title", "artist", "artwork", "territories", "rights"] }),
  pandora: createProfile("pandora", { platform: "pandora", displayName: "Pandora", titleCase: true, supportedLanguages: ["en"], supportedTerritories: ["US"], deliveryHints: ["title", "artist", "genres", "copyright"] }),
  jiosaavn: createProfile("jiosaavn", { platform: "jiosaavn", displayName: "JioSaavn", supportedLanguages: ["en", "hi", "bn", "te", "ta", "mr", "pa"], supportedTerritories: ["IN"], deliveryHints: ["title", "artist", "language", "territories", "copyright"] }),
  boomplay: createProfile("boomplay", { platform: "boomplay", displayName: "Boomplay", supportedTerritories: ["WORLD", "AF", "NG", "GH", "KE", "TZ", "ZA"], deliveryHints: ["title", "artist", "territories", "artwork", "publishing"] }),
  anghami: createProfile("anghami", { platform: "anghami", displayName: "Anghami", supportedLanguages: ["ar", "en", "fr"], supportedTerritories: ["WORLD", "AE", "SA", "QA", "KW", "BH", "OM", "LB", "EG", "JO"], deliveryHints: ["title", "artist", "language", "territories", "lyrics"] }),
  wynk: createProfile("wynk", { platform: "wynk", displayName: "Wynk", supportedTerritories: ["IN"], supportedLanguages: ["en", "hi", "bn", "te", "ta", "mr", "pa"], deliveryHints: ["title", "artist", "territories", "lyrics", "artwork"] }),
});

export function listMetadataDspProfiles(): readonly MetadataDspProfile[] {
  return Object.freeze(Object.values(METADATA_DSP_PROFILES));
}
