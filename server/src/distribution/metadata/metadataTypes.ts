import type { DistributionRelease, DistributionTrack, DistributionParticipant } from "../models/distributionTypes";

export const UNIVERSAL_METADATA_VERSIONS = ["1.0"] as const;
export type UniversalMetadataVersion = (typeof UNIVERSAL_METADATA_VERSIONS)[number];

export type UniversalReleaseKind =
  | "single"
  | "ep"
  | "album"
  | "compilation"
  | "classical"
  | "various_artists"
  | "multi_disc"
  | "instrumental"
  | "podcast"
  | "audiobook";

export type UniversalAdvisory = "none" | "explicit" | "clean";

export type UniversalIdentifierScope = "release" | "track" | "contributor" | "asset" | "publishing" | "rights";

export type UniversalIdentifier = Readonly<{
  type: string;
  value: string;
  scope: UniversalIdentifierScope;
  issuer: string | null;
  metadata: Readonly<Record<string, unknown>>;
}>;

export type UniversalReleaseDateKind = "release" | "original_release" | "recording" | "publication";

export type UniversalReleaseDate = Readonly<{
  kind: UniversalReleaseDateKind;
  value: string;
  year: number | null;
  month: number | null;
  day: number | null;
  isExact: boolean;
  metadata: Readonly<Record<string, unknown>>;
}>;

export type UniversalLanguage = Readonly<{
  code: string;
  name: string | null;
  metadata: Readonly<Record<string, unknown>>;
}>;

export type UniversalGenre = Readonly<{
  primary: string | null;
  subgenre: string | null;
  secondary: string | null;
  secondarySubgenre: string | null;
  metadata: Readonly<Record<string, unknown>>;
}>;

export type UniversalTerritory = Readonly<{
  code: string;
  name: string | null;
  isrc: string | null;
  upc: string | null;
  release: boolean;
  track: boolean;
  metadata: Readonly<Record<string, unknown>>;
}>;

export type UniversalPricing = Readonly<{
  currency: string | null;
  amount: number | null;
  tier: string | null;
  territories: readonly UniversalTerritory[];
  metadata: Readonly<Record<string, unknown>>;
}>;

export type UniversalContributorRole =
  | "primary_artist"
  | "featured_artist"
  | "remixer"
  | "composer"
  | "lyricist"
  | "writer"
  | "producer"
  | "publisher"
  | "arranger"
  | "performer"
  | "master_owner"
  | "rights_holder"
  | string;

export type UniversalContributor = Readonly<{
  name: string;
  roles: readonly UniversalContributorRole[];
  splitPercentage: number | null;
  ipi: string | null;
  isPrimary: boolean;
  metadata: Readonly<Record<string, unknown>>;
}>;

export type UniversalRights = Readonly<{
  copyrightOwner: string | null;
  copyrightYear: number | null;
  copyrightNotice: string | null;
  pLine: string | null;
  cLine: string | null;
  rightsOwned: boolean | null;
  aiContentDeclared: boolean | null;
  territories: readonly UniversalTerritory[];
  metadata: Readonly<Record<string, unknown>>;
}>;

export type UniversalArtwork = Readonly<{
  url: string | null;
  checksum: string | null;
  mimeType: string | null;
  width: number | null;
  height: number | null;
  title: string | null;
  altText: string | null;
  metadata: Readonly<Record<string, unknown>>;
}>;

export type UniversalAudio = Readonly<{
  url: string | null;
  checksum: string | null;
  mimeType: string | null;
  format: string | null;
  durationSeconds: number | null;
  sampleRateHz: number | null;
  channels: number | null;
  bitrateKbps: number | null;
  explicit: boolean;
  metadata: Readonly<Record<string, unknown>>;
}>;

export type UniversalPublishing = Readonly<{
  publisher: string | null;
  writers: readonly UniversalContributor[];
  splits: readonly UniversalContributor[];
  metadata: Readonly<Record<string, unknown>>;
}>;

export type UniversalTrack = Readonly<{
  id: string;
  title: string;
  version: string | null;
  discNumber: number;
  trackNumber: number;
  primaryArtist: string | null;
  featuredArtists: readonly string[];
  remixer: string | null;
  contributorNames: readonly string[];
  contributors: readonly UniversalContributor[];
  publishing: UniversalPublishing;
  audio: UniversalAudio | null;
  rights: UniversalRights | null;
  artwork: UniversalArtwork | null;
  identifiers: readonly UniversalIdentifier[];
  territories: readonly UniversalTerritory[];
  pricing: UniversalPricing | null;
  language: UniversalLanguage | null;
  genre: UniversalGenre;
  advisory: UniversalAdvisory;
  explicit: boolean;
  clean: boolean;
  pLine: string | null;
  cLine: string | null;
  lyrics: string | null;
  recordingYear: number | null;
  metadata: Readonly<Record<string, unknown>>;
}>;

export type UniversalRelease = Readonly<{
  version: UniversalMetadataVersion;
  id: string;
  kind: UniversalReleaseKind;
  title: string;
  releaseType: string | null;
  versionTitle: string | null;
  primaryArtist: string | null;
  featuringArtists: readonly string[];
  variousArtists: boolean;
  label: string | null;
  releaseDate: UniversalReleaseDate | null;
  originalReleaseDate: UniversalReleaseDate | null;
  recordingYear: number | null;
  genre: UniversalGenre;
  language: UniversalLanguage | null;
  advisory: UniversalAdvisory;
  explicit: boolean;
  clean: boolean;
  identifiers: readonly UniversalIdentifier[];
  rights: UniversalRights | null;
  artwork: UniversalArtwork | null;
  audio: UniversalAudio | null;
  publishing: UniversalPublishing;
  contributors: readonly UniversalContributor[];
  territories: readonly UniversalTerritory[];
  pricing: UniversalPricing | null;
  tracks: readonly UniversalTrack[];
  multiDisc: boolean;
  podcast: boolean;
  audiobook: boolean;
  compilation: boolean;
  instrumental: boolean;
  metadata: Readonly<Record<string, unknown>>;
}>;

export type UniversalValidationError = Readonly<{
  path: string;
  code: string;
  message: string;
  severity: "error" | "warning";
  value: unknown;
}>;

export type UniversalValidationResult = Readonly<{
  valid: boolean;
  errors: readonly UniversalValidationError[];
  warnings: readonly UniversalValidationError[];
  metadata: Readonly<Record<string, unknown>>;
}>;

export type UniversalMetadataSnapshot = Readonly<{
  id: string;
  version: UniversalMetadataVersion;
  releaseId: string;
  trackCount: number;
  fingerprint: string;
  createdAt: Date;
  serialized: string;
  metadata: UniversalRelease;
}>;

export type UniversalMetadataDiffEntry = Readonly<{
  path: string;
  before: unknown;
  after: unknown;
  changeType: "added" | "removed" | "changed";
}>;

export type UniversalMetadataDiff = Readonly<{
  identical: boolean;
  changes: readonly UniversalMetadataDiffEntry[];
  beforeFingerprint: string | null;
  afterFingerprint: string | null;
  metadata: Readonly<Record<string, unknown>>;
}>;

export type UniversalMetadataAuditRecord = Readonly<{
  id: string;
  releaseId: string;
  snapshotId: string;
  fingerprint: string;
  createdAt: Date;
  diff: UniversalMetadataDiff | null;
  metadata: Readonly<Record<string, unknown>>;
}>;

export type UniversalMetadataSource = {
  release: DistributionRelease;
  tracks: readonly DistributionTrack[];
};

export type UniversalMetadataTransformerInput = Readonly<{
  release: DistributionRelease;
  tracks: readonly DistributionTrack[];
  version?: UniversalMetadataVersion;
  metadata?: Record<string, unknown>;
}>;

export type UniversalMetadataMapperInput = UniversalMetadataTransformerInput;

export type UniversalReleaseBuilderInput = UniversalMetadataTransformerInput & Readonly<{
  releaseId?: string | null;
  trackMetadata?: Readonly<Record<string, unknown>>;
}>;

export function isUniversalContributor(value: unknown): value is UniversalContributor {
  return Boolean(value && typeof value === "object" && "name" in value && "roles" in value);
}

export function isUniversalTrack(value: unknown): value is UniversalTrack {
  return Boolean(value && typeof value === "object" && "id" in value && "title" in value && "trackNumber" in value);
}

export function isUniversalRelease(value: unknown): value is UniversalRelease {
  return Boolean(value && typeof value === "object" && "id" in value && "tracks" in value && "version" in value);
}

export function cloneParticipant(participant: DistributionParticipant): UniversalContributor {
  return {
    name: participant.name,
    roles: participant.role,
    splitPercentage: null,
    ipi: null,
    isPrimary: false,
    metadata: {},
  };
}

