import type {
  UniversalContributor,
  UniversalContributorRole,
  UniversalIdentifier,
  UniversalMetadataTransformerInput,
  UniversalPricing,
  UniversalRelease,
  UniversalReleaseKind,
  UniversalPublishing,
  UniversalTerritory,
  UniversalTrack,
} from "./metadataTypes";
import { MetadataDefaults } from "./metadataDefaults";
import { MetadataNormalizer } from "./metadataNormalizer";
import { deepFreeze } from "./metadataUtils";

export type MetadataTransformerOptions = Readonly<{
  defaults?: MetadataDefaults;
  normalizer?: MetadataNormalizer;
}>;

export class MetadataTransformer {
  constructor(
    private readonly defaults = new MetadataDefaults(),
    private readonly normalizer = new MetadataNormalizer(),
  ) {}

  transform(input: UniversalMetadataTransformerInput): UniversalRelease {
    const releaseMeta = readMetadata(input.release.metadata);
    const trackCount = input.tracks.length;
    const kind = this.defaults.releaseKind(
      trackCount,
      Boolean(input.release.variousArtists),
      Boolean(input.release.copyrightDeclared),
      isPodcast(input.release, releaseMeta),
      isAudiobook(input.release, releaseMeta),
      isInstrumental(input.release, input.tracks, releaseMeta),
      isCompilation(input.release, releaseMeta),
      hasMultipleDiscs(input.tracks, releaseMeta),
    );

    const tracks = input.tracks.map((track, index) =>
      this.transformTrack({
        release: input.release,
        track,
        index,
        releaseKind: kind,
        releaseMetadata: releaseMeta,
        trackMetadata: readMetadata(track.metadata),
      }),
    );

    const contributors = this.normalizeContributors([
      this.normalizer.contributor(input.release.primaryArtist, ["primary_artist"], null),
      ...readStringArray(input.release.featuredArtists).map((artist) =>
        this.normalizer.contributor(artist, ["featured_artist"], null),
      ),
      ...tracks.flatMap((track) => track.contributors),
    ]);

    const territories = this.normalizeTerritories([
      ...resolveTerritories(readMetadata(input.release.metadata), releaseMeta),
      ...this.defaults.territories(),
    ]);
    const releaseDate = this.defaults.releaseDate("release", input.release.releaseDate ?? readString(releaseMeta.releaseDate) ?? null);
    const originalReleaseDate = this.defaults.releaseDate(
      "original_release",
      input.release.originalReleaseDate ?? readString(releaseMeta.originalReleaseDate) ?? null,
    );
    const advisory = this.defaults.advisory(
      Boolean(input.release.copyrightDeclared),
      Boolean(input.release.aiContentDeclared),
      readString(releaseMeta.advisory),
    );
    const genre = this.normalizer.genre(
      input.release.genre ?? readString(releaseMeta.genre),
      input.release.subgenre ?? readString(releaseMeta.subgenre),
      readString(releaseMeta.secondaryGenre),
      readString(releaseMeta.secondarySubgenre),
    );
    const language = this.defaults.language(input.release.language ?? readString(releaseMeta.language), readString(releaseMeta.languageName));
    const rights = this.normalizer.rights({
      copyrightOwner: input.release.copyrightOwner ?? readString(releaseMeta.copyrightOwner),
      copyrightYear: toYear(input.release.productionYear ?? releaseMeta.copyrightYear),
      copyrightNotice: input.release.copyright ?? readString(releaseMeta.copyrightNotice),
      pLine: input.release.pLine ?? readString(releaseMeta.pLine),
      cLine: input.release.cLine ?? readString(releaseMeta.cLine),
      rightsOwned: readBoolean(input.release.rightsOwned) ?? readBoolean(releaseMeta.rightsOwned),
      aiContentDeclared: readBoolean(input.release.aiContentDeclared) ?? readBoolean(releaseMeta.aiContentDeclared),
      territories,
      metadata: Object.freeze({}),
    });
    const artwork = this.normalizer.artwork({
      url: input.release.coverArtUrl ?? readString(releaseMeta.coverArtUrl),
      checksum: readString(releaseMeta.artworkChecksum),
      mimeType: readString(releaseMeta.artworkMimeType),
      title: input.release.title ?? readString(releaseMeta.artworkTitle),
      altText: readString(releaseMeta.artworkAltText),
      metadata: Object.freeze({}),
    });
    const identifiers = this.normalizer.identifiers([
      this.normalizer.identifier("internal", input.release.id, "release"),
      this.normalizer.identifier("upc", input.release.upc ?? readString(releaseMeta.upc), "release"),
      this.normalizer.identifier("catalogue", input.release.producerCatalogueNumber ?? readString(releaseMeta.producerCatalogueNumber), "release"),
    ].filter((value): value is UniversalIdentifier => Boolean(value)));

    const pricing = this.normalizer.pricing(
      readNumber(releaseMeta.price),
      readString(releaseMeta.priceTier),
      territories,
    );
    const primaryArtist = this.normalizer.text(input.release.primaryArtist ?? readString(releaseMeta.primaryArtist));
    const title = this.normalizer.text(input.release.title ?? readString(releaseMeta.title) ?? tracks[0]?.title) ?? "Untitled Release";
    const versionTitle = this.normalizer.text(input.release.version ?? readString(releaseMeta.version));

    return deepFreeze({
      version: input.version ?? "1.0",
      id: input.release.id,
      kind,
      title,
      releaseType: this.normalizer.text(input.release.type ?? readString(releaseMeta.releaseType)),
      versionTitle,
      primaryArtist,
      featuringArtists: this.normalizer.textArray(readStringArray(input.release.featuredArtists ?? releaseMeta.featuredArtists)),
      variousArtists: Boolean(input.release.variousArtists ?? releaseMeta.variousArtists),
      label: this.normalizer.text(input.release.labelName ?? readString(releaseMeta.labelName)),
      releaseDate,
      originalReleaseDate,
      recordingYear: toYear(input.release.productionYear ?? releaseMeta.recordingYear),
      genre,
      language,
      advisory,
      explicit: advisory === "explicit",
      clean: advisory === "clean",
      identifiers,
      rights,
      artwork,
      audio: null,
      publishing: this.createPublishing(input.release.labelName ?? readString(releaseMeta.labelName), contributors),
      contributors,
      territories,
      pricing,
      tracks,
      multiDisc: tracks.some((track) => track.discNumber > 1),
      podcast: kind === "podcast",
      audiobook: kind === "audiobook",
      compilation: kind === "compilation" || kind === "various_artists",
      instrumental: kind === "instrumental" || tracks.every((track) => track.audio?.explicit === false),
      metadata: deepFreeze(Object.freeze({ ...releaseMeta, ...(input.metadata ?? {}) })),
    }) as UniversalRelease;
  }

  transformTrack(input: {
    release: UniversalMetadataTransformerInput["release"];
    track: UniversalMetadataTransformerInput["tracks"][number];
    index: number;
    releaseKind: UniversalReleaseKind;
    releaseMetadata: Record<string, unknown>;
    trackMetadata: Record<string, unknown>;
  }): UniversalTrack {
    const contributors = this.normalizeContributors([
      this.normalizer.contributor(input.track.primaryArtist ?? input.release.primaryArtist, ["primary_artist"], null),
      ...readStringArray(input.track.featuredArtists).map((artist) => this.normalizer.contributor(artist, ["featured_artist"], null)),
      this.normalizer.contributor(input.track.remixer, ["remixer"], null),
      this.normalizer.contributor(input.track.composer, ["composer"], null),
      this.normalizer.contributor(input.track.author, ["lyricist"], null),
      this.normalizer.contributor(input.track.producer, ["producer"], null),
      ...(input.track.writers ?? []).map((writer) =>
        this.normalizer.contributor(writer.name, writer.role as readonly UniversalContributorRole[], null, { source: "writer" }),
      ),
    ]);
    const territories = this.normalizeTerritories([
      ...resolveTerritories(input.track.metadata, input.trackMetadata),
      ...this.defaults.territories(),
    ]);
    const language = this.defaults.language(
      input.track.trackTitleLanguage ?? input.track.lyricsLanguage ?? input.release.language ?? readString(input.releaseMetadata["language"]),
      readString(input.trackMetadata["languageName"]),
    );
    const advisory = this.defaults.advisory(
      input.track.parentalAdvisory === "explicit" || Boolean(input.track.explicit),
      input.track.parentalAdvisory === "clean",
      readString(input.trackMetadata["advisory"]),
    );
    const genre = this.normalizer.genre(
      input.track.genre ?? readString(input.trackMetadata["genre"]) ?? input.release.genre,
      input.track.subgenre ?? readString(input.trackMetadata["subgenre"]) ?? input.release.subgenre,
      input.track.secondaryGenre ?? readString(input.trackMetadata["secondaryGenre"]),
      input.track.secondarySubgenre ?? readString(input.trackMetadata["secondarySubgenre"]),
    );
    const audio = this.normalizer.audio({
      url: input.track.audioUrl ?? readString(input.trackMetadata["audioUrl"]),
      checksum: readString(input.trackMetadata["audioChecksum"]),
      mimeType: input.track.audioFormat ?? readString(input.trackMetadata["audioMimeType"]),
      format: input.track.audioFormat ?? readString(input.trackMetadata["audioFormat"]),
      durationSeconds: readNumber(input.trackMetadata["durationSeconds"]),
      sampleRateHz: readNumber(input.trackMetadata["sampleRateHz"]),
      channels: readNumber(input.trackMetadata["channels"]),
      bitrateKbps: readNumber(input.trackMetadata["bitrateKbps"]),
      explicit: Boolean(input.track.explicit),
      metadata: Object.freeze({}),
    });
    const artwork = this.normalizer.artwork({
      url: readString(input.trackMetadata["artworkUrl"]) ?? input.release.coverArtUrl ?? null,
      checksum: readString(input.trackMetadata["artworkChecksum"]),
      mimeType: readString(input.trackMetadata["artworkMimeType"]),
      title: input.track.title,
      altText: readString(input.trackMetadata["artworkAltText"]),
      metadata: Object.freeze({}),
    });
    const identifiers = this.normalizer.identifiers([
      this.normalizer.identifier("internal", input.track.id, "track"),
      this.normalizer.identifier("isrc", input.track.isrc ?? input.track.providerIsrc ?? readString(input.trackMetadata["isrc"]), "track"),
      this.normalizer.identifier("provider", input.track.providerTrackId, "track"),
      this.normalizer.identifier("catalogue", input.track.producerCatalogueNumber ?? readString(input.trackMetadata["producerCatalogueNumber"]), "track"),
    ].filter((value): value is UniversalIdentifier => Boolean(value)));
    const rights = this.normalizer.rights({
      copyrightOwner: input.release.copyrightOwner ?? readString(input.releaseMetadata["copyrightOwner"]),
      copyrightYear: toYear(input.track.productionYear ?? readString(input.trackMetadata["productionYear"]) ?? input.release.productionYear ?? readString(input.releaseMetadata["copyrightYear"])),
      copyrightNotice: input.track.pLine ?? readString(input.trackMetadata["copyrightNotice"]),
      pLine: input.track.pLine ?? readString(input.trackMetadata["pLine"]),
      cLine: input.release.cLine ?? readString(input.releaseMetadata["cLine"]),
      rightsOwned: readBoolean(input.release.rightsOwned) ?? readBoolean(input.releaseMetadata["rightsOwned"]),
      aiContentDeclared: readBoolean(input.release.aiContentDeclared) ?? readBoolean(input.releaseMetadata["aiContentDeclared"]),
      territories,
      metadata: Object.freeze({}),
    });
    const pricing = this.normalizer.pricing(undefined, input.track.priceTier ?? readString(input.trackMetadata["priceTier"]), territories);
    const publishing = this.createPublishing(input.track.publisher ?? readString(input.trackMetadata["publisher"]), contributors);

    return deepFreeze({
      id: input.track.id,
      title: this.normalizer.text(input.track.title) ?? "Untitled Track",
      version: this.normalizer.text(input.track.version ?? readString(input.trackMetadata["version"])),
      discNumber: toPositiveInteger(input.trackMetadata["discNumber"] ?? input.trackMetadata["disc_number"]) ?? 1,
      trackNumber: toPositiveInteger(input.trackMetadata["trackNumber"] ?? input.trackMetadata["track_number"] ?? input.index + 1) ?? input.index + 1,
      primaryArtist: this.normalizer.text(input.track.primaryArtist ?? input.release.primaryArtist),
      featuredArtists: this.normalizer.textArray(readStringArray(input.track.featuredArtists)),
      remixer: this.normalizer.text(input.track.remixer),
      contributorNames: this.normalizer.textArray([
        input.track.primaryArtist ?? input.release.primaryArtist,
        ...readStringArray(input.track.featuredArtists),
        input.track.remixer,
      ]),
      contributors,
      publishing,
      audio,
      rights,
      artwork,
      identifiers,
      territories,
      pricing,
      language,
      genre,
      advisory,
      explicit: advisory === "explicit",
      clean: advisory === "clean",
      pLine: this.normalizer.text(input.track.pLine ?? readString(input.trackMetadata["pLine"])),
      cLine: this.normalizer.text(readString(input.trackMetadata["cLine"])),
      lyrics: this.normalizer.text(input.track.lyrics ?? readString(input.trackMetadata["lyrics"])),
      recordingYear: toYear(input.track.productionYear ?? readString(input.trackMetadata["productionYear"])),
      metadata: deepFreeze(Object.freeze({ ...input.trackMetadata })),
    }) as UniversalTrack;
  }

  private createPublishing(publisher: string | null | undefined, writers: readonly UniversalContributor[]): UniversalPublishing {
    const normalizedPublisher = this.normalizer.text(publisher);
    return deepFreeze({
      publisher: normalizedPublisher,
      writers: writers.filter((contributor) => contributor.roles.includes("writer") || contributor.roles.includes("composer") || contributor.roles.includes("lyricist")),
      splits: writers.filter((contributor) => typeof contributor.splitPercentage === "number"),
      metadata: Object.freeze({}),
    });
  }

  private normalizeContributors(items: Array<UniversalContributor | null | undefined>): readonly UniversalContributor[] {
    return this.normalizer.contributors(items.filter((value): value is UniversalContributor => Boolean(value)));
  }

  private normalizeTerritories(items: readonly UniversalTerritory[] | null | undefined): readonly UniversalTerritory[] {
    return this.normalizer.territories(items ?? []);
  }
}

function readMetadata(value: Record<string, unknown> | null | undefined): Record<string, unknown> {
  return value && typeof value === "object" ? value : {};
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readStringArray(value: unknown): readonly string[] {
  return Array.isArray(value) ? value.map((entry) => readString(entry)).filter((entry): entry is string => Boolean(entry)) : [];
}

function readBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function readNumber(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toNumber(value: unknown): number | null {
  return readNumber(value);
}

function toYear(value: unknown): number | null {
  const parsed = toNumber(value);
  if (parsed == null) return null;
  return parsed > 0 ? Math.trunc(parsed) : null;
}

function toPositiveInteger(value: unknown): number | null {
  const parsed = toNumber(value);
  if (parsed == null) return null;
  const rounded = Math.trunc(parsed);
  return rounded > 0 ? rounded : null;
}

function resolveTerritories(...sources: Array<Record<string, unknown> | null | undefined>): readonly UniversalTerritory[] {
  const territories: UniversalTerritory[] = [];
  for (const source of sources) {
    if (!source) continue;
    const raw = source.territories ?? source.territoryCodes ?? source.markets;
    if (!Array.isArray(raw)) continue;
    for (const entry of raw) {
      const code = typeof entry === "string" ? entry : isPlainTerritory(entry) ? entry.code : null;
      if (!code) continue;
      territories.push({
        code: code.toUpperCase(),
        name: isPlainTerritory(entry) ? readString(entry.name) : null,
        isrc: null,
        upc: null,
        release: true,
        track: true,
        metadata: Object.freeze({}),
      });
    }
  }
  return territories;
}

function isPlainTerritory(value: unknown): value is { code: string; name?: string | null } {
  return Boolean(value && typeof value === "object" && "code" in value && typeof (value as { code?: unknown }).code === "string");
}

function isPodcast(release: { format?: string | null }, metadata: Record<string, unknown>): boolean {
  return [release.format, metadata.releaseKind, metadata.format].some((value) => typeof value === "string" && value.toLowerCase() === "podcast");
}

function isAudiobook(release: { format?: string | null }, metadata: Record<string, unknown>): boolean {
  return [release.format, metadata.releaseKind, metadata.format].some((value) => typeof value === "string" && value.toLowerCase() === "audiobook");
}

function isInstrumental(release: { format?: string | null }, tracks: readonly unknown[], metadata: Record<string, unknown>): boolean {
  return Boolean(metadata.instrumental) || (tracks.length > 0 && tracks.every((track) => Boolean((track as { instrumental?: unknown }).instrumental)));
}

function isCompilation(release: { variousArtists?: boolean }, metadata: Record<string, unknown>): boolean {
  return Boolean(release.variousArtists) || String(metadata.releaseKind ?? "").toLowerCase() === "compilation";
}

function hasMultipleDiscs(tracks: readonly unknown[], metadata: Record<string, unknown>): boolean {
  return Boolean(metadata.multiDisc) || tracks.some((track) => toPositiveInteger((track as { discNumber?: unknown }).discNumber) && (track as { discNumber?: unknown }).discNumber !== 1);
}
