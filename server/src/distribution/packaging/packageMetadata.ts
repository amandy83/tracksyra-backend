import type {
  UniversalContributor,
  UniversalGenre,
  UniversalLanguage,
  UniversalPricing,
  UniversalRelease,
  UniversalRights,
  UniversalTrack,
  UniversalTerritory,
} from "../metadata";
import { deepFreeze, toJsonText } from "./packageUtils";

export type PackageMetadataDocuments = Readonly<{
  release: Readonly<Record<string, unknown>>;
  tracks: readonly Readonly<Record<string, unknown>>[];
  contributors: readonly Readonly<Record<string, unknown>>[];
  publishing: Readonly<Record<string, unknown>>;
  rights: Readonly<Record<string, unknown>>;
  territories: readonly Readonly<Record<string, unknown>>[];
  pricing: Readonly<Record<string, unknown>>;
}>;

export class PackageMetadata {
  constructor(private readonly release: UniversalRelease) {}

  documents(): PackageMetadataDocuments {
    return deepFreeze({
      release: this.releaseDocument(),
      tracks: this.trackDocuments(),
      contributors: this.contributorDocuments(),
      publishing: this.publishingDocument(),
      rights: this.rightsDocument(),
      territories: this.territoryDocuments(),
      pricing: this.pricingDocument(),
    });
  }

  releaseJson(): string {
    return toJsonText(this.releaseDocument());
  }

  tracksJson(): string {
    return toJsonText(this.trackDocuments());
  }

  contributorsJson(): string {
    return toJsonText(this.contributorDocuments());
  }

  publishingJson(): string {
    return toJsonText(this.publishingDocument());
  }

  rightsJson(): string {
    return toJsonText(this.rightsDocument());
  }

  territoriesJson(): string {
    return toJsonText(this.territoryDocuments());
  }

  pricingJson(): string {
    return toJsonText(this.pricingDocument());
  }

  private releaseDocument(): Readonly<Record<string, unknown>> {
    const genre = this.release.genre;
    const language = this.release.language;
    return {
      id: this.release.id,
      version: this.release.version,
      kind: this.release.kind,
      title: this.release.title,
      releaseType: this.release.releaseType,
      versionTitle: this.release.versionTitle,
      primaryArtist: this.release.primaryArtist,
      featuringArtists: this.release.featuringArtists,
      variousArtists: this.release.variousArtists,
      label: this.release.label,
      releaseDate: this.release.releaseDate,
      originalReleaseDate: this.release.originalReleaseDate,
      recordingYear: this.release.recordingYear,
      genre: serializeGenre(genre),
      language: serializeLanguage(language),
      advisory: this.release.advisory,
      explicit: this.release.explicit,
      clean: this.release.clean,
      identifiers: this.release.identifiers,
      rights: serializeRights(this.release.rights),
      artwork: this.release.artwork,
      audio: this.release.audio,
      publishing: this.release.publishing,
      contributors: this.release.contributors,
      territories: this.release.territories,
      pricing: serializePricing(this.release.pricing),
      tracks: this.release.tracks.map((track) => track.id),
      multiDisc: this.release.multiDisc,
      podcast: this.release.podcast,
      audiobook: this.release.audiobook,
      compilation: this.release.compilation,
      instrumental: this.release.instrumental,
    };
  }

  private trackDocuments(): readonly Readonly<Record<string, unknown>>[] {
    return this.release.tracks.map((track) => ({
      id: track.id,
      title: track.title,
      version: track.version,
      discNumber: track.discNumber,
      trackNumber: track.trackNumber,
      primaryArtist: track.primaryArtist,
      featuredArtists: track.featuredArtists,
      remixer: track.remixer,
      contributorNames: track.contributorNames,
      contributors: track.contributors,
      publishing: track.publishing,
      audio: track.audio,
      rights: track.rights,
      artwork: track.artwork,
      identifiers: track.identifiers,
      territories: track.territories,
      pricing: serializePricing(track.pricing),
      language: serializeLanguage(track.language),
      genre: serializeGenre(track.genre),
      advisory: track.advisory,
      explicit: track.explicit,
      clean: track.clean,
      pLine: track.pLine,
      cLine: track.cLine,
      lyrics: track.lyrics,
      recordingYear: track.recordingYear,
    }));
  }

  private contributorDocuments(): readonly Readonly<Record<string, unknown>>[] {
    return dedupeContributors([...this.release.contributors, ...this.release.tracks.flatMap((track) => track.contributors)]).map((contributor) => ({
      name: contributor.name,
      roles: contributor.roles,
      splitPercentage: contributor.splitPercentage,
      ipi: contributor.ipi,
      isPrimary: contributor.isPrimary,
      metadata: contributor.metadata,
    }));
  }

  private publishingDocument(): Readonly<Record<string, unknown>> {
    return {
      publisher: this.release.publishing.publisher,
      writers: this.release.publishing.writers,
      splits: this.release.publishing.splits,
    };
  }

  private rightsDocument(): Readonly<Record<string, unknown>> {
    return {
      release: serializeRights(this.release.rights),
      tracks: this.release.tracks.map((track) => serializeRights(track.rights)),
    };
  }

  private territoryDocuments(): readonly Readonly<Record<string, unknown>>[] {
    return dedupeTerritories([...this.release.territories, ...this.release.tracks.flatMap((track) => track.territories)]).map((territory) => ({
      code: territory.code,
      name: territory.name,
      isrc: territory.isrc,
      upc: territory.upc,
      release: territory.release,
      track: territory.track,
    }));
  }

  private pricingDocument(): Readonly<Record<string, unknown>> {
    return {
      release: serializePricing(this.release.pricing),
      tracks: this.release.tracks.map((track) => serializePricing(track.pricing)),
    };
  }
}

function serializeGenre(value: UniversalGenre | null): Readonly<Record<string, unknown>> | null {
  return value ? { primary: value.primary, subgenre: value.subgenre, secondary: value.secondary, secondarySubgenre: value.secondarySubgenre } : null;
}

function serializeLanguage(value: UniversalLanguage | null): Readonly<Record<string, unknown>> | null {
  return value ? { code: value.code, name: value.name } : null;
}

function serializePricing(value: UniversalPricing | null): Readonly<Record<string, unknown>> | null {
  return value ? { currency: value.currency, amount: value.amount, tier: value.tier, territories: value.territories } : null;
}

function serializeRights(value: UniversalRights | null): Readonly<Record<string, unknown>> | null {
  return value ? {
    copyrightOwner: value.copyrightOwner,
    copyrightYear: value.copyrightYear,
    copyrightNotice: value.copyrightNotice,
    pLine: value.pLine,
    cLine: value.cLine,
    rightsOwned: value.rightsOwned,
    aiContentDeclared: value.aiContentDeclared,
    territories: value.territories,
  } : null;
}

function dedupeContributors(values: readonly UniversalContributor[]): readonly UniversalContributor[] {
  const seen = new Set<string>();
  const result: UniversalContributor[] = [];
  for (const contributor of values) {
    const key = contributor.name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(contributor);
  }
  return result;
}

function dedupeTerritories(values: readonly UniversalTerritory[]): readonly UniversalTerritory[] {
  const seen = new Set<string>();
  const result: UniversalTerritory[] = [];
  for (const territory of values) {
    const key = territory.code.toUpperCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(territory);
  }
  return result;
}

