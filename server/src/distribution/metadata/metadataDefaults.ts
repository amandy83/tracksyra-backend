import type {
  UniversalAdvisory,
  UniversalReleaseKind,
  UniversalReleaseDateKind,
  UniversalLanguage,
  UniversalTerritory,
} from "./metadataTypes";
import { MetadataNormalizer } from "./metadataNormalizer";

export type MetadataDefaultsOptions = Readonly<{
  defaultLanguage?: string;
  defaultLanguageName?: string | null;
  defaultReleaseKind?: UniversalReleaseKind;
  defaultAdvisory?: UniversalAdvisory;
  defaultTerritories?: readonly UniversalTerritory[];
}>;

export class MetadataDefaults {
  readonly defaultLanguage: string;
  readonly defaultLanguageName: string | null;
  readonly defaultReleaseKind: UniversalReleaseKind;
  readonly defaultAdvisory: UniversalAdvisory;
  readonly defaultTerritories: readonly UniversalTerritory[];

  constructor(private readonly normalizer = new MetadataNormalizer(), options: MetadataDefaultsOptions = {}) {
    this.defaultLanguage = options.defaultLanguage ?? "und";
    this.defaultLanguageName = options.defaultLanguageName ?? null;
    this.defaultReleaseKind = options.defaultReleaseKind ?? "album";
    this.defaultAdvisory = options.defaultAdvisory ?? "none";
    this.defaultTerritories = Object.freeze([...(options.defaultTerritories ?? [])]);
  }

  language(input?: unknown, name?: string | null): UniversalLanguage {
    return this.normalizer.language(input, this.defaultLanguage, name ?? this.defaultLanguageName);
  }

  releaseKind(trackCount: number, variousArtists: boolean, explicit: boolean, podcast = false, audiobook = false, instrumental = false, compilation = false, multiDisc = false): UniversalReleaseKind {
    if (podcast) return "podcast";
    if (audiobook) return "audiobook";
    if (compilation || variousArtists) return "compilation";
    if (multiDisc) return "multi_disc";
    if (instrumental) return "instrumental";
    if (trackCount <= 1) return "single";
    if (trackCount <= 6) return "ep";
    if (explicit && trackCount === 1) return "single";
    return this.defaultReleaseKind;
  }

  advisory(explicit?: boolean, clean?: boolean, value?: string | null): UniversalAdvisory {
    if (value) return this.normalizer.advisory(value, explicit, clean);
    if (explicit) return "explicit";
    if (clean) return "clean";
    return this.defaultAdvisory;
  }

  releaseDate(kind: UniversalReleaseDateKind, input?: unknown) {
    return this.normalizer.date(input ?? null, kind);
  }

  territories(): readonly UniversalTerritory[] {
    return this.defaultTerritories;
  }
}

