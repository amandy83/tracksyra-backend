export const DISTRIBUTION_PLATFORMS = [
  "too_lost",
] as const;

export const DISTRIBUTION_PROVIDERS = [
  "internal",
  "too_lost",
] as const;

export type DistributionPlatform = (typeof DISTRIBUTION_PLATFORMS)[number];
export type DistributionProvider = (typeof DISTRIBUTION_PROVIDERS)[number];
export type LegacyDistributionPlatform = "spotify" | "apple_music" | "youtube_music" | "deezer" | "amazon_music";
export type DistributionPlatformName = DistributionPlatform | LegacyDistributionPlatform;

export type DistributionJobStatus =
  | "PENDING"
  | "PROCESSING"
  | "SUBMITTED"
  | "IN_REVIEW"
  | "APPROVED"
  | "DELIVERED"
  | "PUBLISHED"
  | "REJECTED"
  | "FAILED"
  | "DEAD_LETTER";

export type DistributionJob = {
  id: string;
  releaseId?: string;
  trackId?: string;
  platform: DistributionPlatformName;
  status: DistributionJobStatus;
  createdAt: Date;
  attempts?: number;
  nextRetryAt?: Date | null;
};

export type DistributionRelease = {
  id: string;
  userId: string;
  artistId?: string;
  title?: string;
  status?: string | null;
  artistMode?: "existing" | "new" | string | null;
  spotifyArtistId?: string | null;
  appleArtistId?: string | null;
  providerStatus?: string | null;
  distributionStatus?: string | null;
  providerReleaseId?: string | null;
  providerUpdatedAt?: string | null;
  providerReviewNotes?: string | null;
  providerWarningNotes?: string | null;
  providerValidationMessages?: unknown;
  providerDeliveryMessages?: unknown;
  version?: string | null;
  primaryArtist?: string;
  featuredArtists?: string[];
  variousArtists?: boolean;
  metadata?: Record<string, unknown>;
  releaseDate?: string | null;
  originalReleaseDate?: string | null;
  genre?: string | null;
  subgenre?: string | null;
  labelName?: string | null;
  format?: string | null;
  language?: string | null;
  upc?: string | null;
  copyrightOwner?: string | null;
  copyright?: string | null;
  copyrightDeclared?: boolean;
  aiContentDeclared?: boolean;
  rightsOwned?: boolean;
  pLine?: string | null;
  cLine?: string | null;
  productionYear?: string | null;
  producerCatalogueNumber?: string | null;
  coverArtUrl?: string | null;
  type?: "single" | "ep" | "album" | "compilation";
};

export type DistributionParticipant = {
  name: string;
  role: string[];
};

export type DistributionTrack = {
  id: string;
  releaseId: string;
  userId: string;
  artistId?: string;
  status?: string | null;
  artistMode?: "existing" | "new" | string | null;
  spotifyArtistId?: string | null;
  appleArtistId?: string | null;
  providerStatus?: string | null;
  providerTrackId?: string | null;
  providerIsrc?: string | null;
  providerUpdatedAt?: string | null;
  providerReviewNotes?: string | null;
  providerWarningNotes?: string | null;
  providerValidationMessages?: unknown;
  providerDeliveryMessages?: unknown;
  title?: string;
  version?: string | null;
  primaryArtist?: string;
  featuredArtists?: string[];
  contentType?: string | null;
  primaryTrackType?: string | null;
  secondaryTrackType?: string | null;
  instrumental?: boolean;
  remixer?: string | null;
  author?: string | null;
  composer?: string | null;
  arranger?: string | null;
  producer?: string | null;
  pLine?: string | null;
  productionYear?: string | null;
  publisher?: string | null;
  genre?: string | null;
  subgenre?: string | null;
  secondaryGenre?: string | null;
  secondarySubgenre?: string | null;
  priceTier?: string | null;
  producerCatalogueNumber?: string | null;
  parentalAdvisory?: "none" | "explicit" | "clean" | null;
  previewStart?: number | null;
  trackTitleLanguage?: string | null;
  lyricsLanguage?: string | null;
  lyrics?: string | null;
  moreInfo?: string | null;
  generateIsrc?: boolean | null;
  writers?: DistributionParticipant[];
  metadata?: Record<string, unknown>;
  audioUrl?: string | null;
  audioFormat?: string | null;
  isrc?: string | null;
  explicit?: boolean;
};

export type Release = DistributionRelease;
export type Track = DistributionTrack;

export type NormalizedDistributionError = {
  errorCode: string;
  message: string;
  platform: DistributionPlatformName;
  provider: DistributionProvider;
  retryable: boolean;
};
