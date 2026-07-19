import type { DistributionRelease, DistributionTrack } from "../../models/distributionTypes";
import type { UniversalRelease, UniversalReleaseKind, UniversalValidationError, UniversalValidationResult, UniversalMetadataDiff, UniversalMetadataSnapshot } from "../../metadata";

export type MetadataDspName =
  | "spotify"
  | "apple_music"
  | "youtube_music"
  | "amazon_music"
  | "deezer"
  | "tidal"
  | "tiktok"
  | "meta"
  | "pandora"
  | "jiosaavn"
  | "boomplay"
  | "anghami"
  | "wynk";

export type MetadataScoreKind =
  | "metadata_quality"
  | "metadata_confidence"
  | "metadata_completeness"
  | "dsp_compatibility"
  | "publishing"
  | "rights"
  | "delivery"
  | "artwork"
  | "overall_release";

export type MetadataRecommendationKind =
  | "title"
  | "genre"
  | "mood"
  | "contributors"
  | "writers"
  | "publishers"
  | "composers"
  | "copyright"
  | "territories"
  | "artwork"
  | "lyrics"
  | "identifiers"
  | "platform_fix";

export type MetadataRecommendation = Readonly<{
  kind: MetadataRecommendationKind;
  platform: MetadataDspName | null;
  field: string;
  message: string;
  severity: "info" | "warning" | "error";
  confidence: number;
  metadata: Readonly<Record<string, unknown>>;
}>;

export type MetadataRepairAction = Readonly<{
  field: string;
  before: unknown;
  after: unknown;
  reason: string;
  confidence: number;
}>;

export type MetadataConflictKind =
  | "duplicate_title"
  | "duplicate_album"
  | "duplicate_release"
  | "duplicate_contributor"
  | "duplicate_composer"
  | "duplicate_isrc"
  | "duplicate_upc"
  | "duplicate_iswc"
  | "duplicate_ipi"
  | "duplicate_alias";

export type MetadataConflict = Readonly<{
  kind: MetadataConflictKind;
  releaseId: string;
  trackId: string | null;
  relatedReleaseId: string | null;
  relatedTrackId: string | null;
  message: string;
  severity: "low" | "medium" | "high" | "critical";
  evidence: Readonly<Record<string, unknown>>;
}>;

export type MetadataQualityScore = Readonly<{
  releaseId: string;
  trackId: string | null;
  metadataQualityScore: number;
  metadataConfidenceScore: number;
  metadataCompletenessScore: number;
  dspCompatibilityScore: number;
  publishingScore: number;
  rightsScore: number;
  deliveryScore: number;
  artworkScore: number;
  overallReleaseScore: number;
  metadata: Readonly<Record<string, unknown>>;
}>;

export type MetadataCompatibilityScore = Readonly<{
  releaseId: string;
  trackId: string | null;
  platform: MetadataDspName;
  score: number;
  compatible: boolean;
  issues: readonly string[];
  warnings: readonly string[];
  metadata: Readonly<Record<string, unknown>>;
}>;

export type MetadataValidationReport = Readonly<{
  generatedAt: string;
  releaseId: string;
  trackId: string | null;
  valid: boolean;
  validation: UniversalValidationResult;
  conflicts: readonly MetadataConflict[];
  repairs: readonly MetadataRepairAction[];
  metadata: Readonly<Record<string, unknown>>;
}>;

export type MetadataQualityReport = Readonly<{
  generatedAt: string;
  releaseId: string;
  trackId: string | null;
  summary: Readonly<Record<string, unknown>>;
  scores: MetadataQualityScore;
  recommendations: readonly MetadataRecommendation[];
  metadata: Readonly<Record<string, unknown>>;
}>;

export type MetadataCompatibilityReport = Readonly<{
  generatedAt: string;
  releaseId: string;
  trackId: string | null;
  scores: readonly MetadataCompatibilityScore[];
  summary: Readonly<Record<string, unknown>>;
  metadata: Readonly<Record<string, unknown>>;
}>;

export type MetadataPublishingReport = Readonly<{
  generatedAt: string;
  releaseId: string;
  trackId: string | null;
  summary: Readonly<Record<string, unknown>>;
  metadata: Readonly<Record<string, unknown>>;
}>;

export type MetadataRightsReport = Readonly<{
  generatedAt: string;
  releaseId: string;
  trackId: string | null;
  summary: Readonly<Record<string, unknown>>;
  metadata: Readonly<Record<string, unknown>>;
}>;

export type ReleaseReadinessReport = Readonly<{
  generatedAt: string;
  releaseId: string;
  trackId: string | null;
  ready: boolean;
  score: number;
  blockers: readonly string[];
  warnings: readonly string[];
  metadata: Readonly<Record<string, unknown>>;
}>;

export type MetadataAuditEntry = Readonly<{
  id: string;
  releaseId: string;
  trackId: string | null;
  versionId: string;
  action: string;
  actor: string;
  correlationId: string | null;
  createdAt: string;
  metadata: Readonly<Record<string, unknown>>;
}>;

export type MetadataVersionRecord = Readonly<{
  versionId: string;
  releaseId: string;
  trackId: string | null;
  fingerprint: string;
  createdAt: string;
  metadata: UniversalRelease;
  diff: UniversalMetadataDiff | null;
}>;

export type MetadataHistoryEntry = Readonly<{
  historyId: string;
  releaseId: string;
  trackId: string | null;
  action: string;
  beforeVersionId: string | null;
  afterVersionId: string;
  createdAt: string;
  metadata: Readonly<Record<string, unknown>>;
}>;

export type MetadataNormalizationResult = Readonly<{
  generatedAt: string;
  release: DistributionRelease;
  track: DistributionTrack | null;
  universalRelease: UniversalRelease;
  validation: UniversalValidationResult;
  repairs: readonly MetadataRepairAction[];
  recommendations: readonly MetadataRecommendation[];
  conflicts: readonly MetadataConflict[];
  quality: MetadataQualityScore;
  compatibility: readonly MetadataCompatibilityScore[];
  metadata: Readonly<Record<string, unknown>>;
}>;

export type MetadataRepairResult = Readonly<{
  generatedAt: string;
  release: DistributionRelease;
  track: DistributionTrack | null;
  repairs: readonly MetadataRepairAction[];
  validation: UniversalValidationResult;
  universalRelease: UniversalRelease;
  metadata: Readonly<Record<string, unknown>>;
}>;

export type MetadataAssistantSuggestion = Readonly<{
  generatedAt: string;
  releaseId: string;
  trackId: string | null;
  suggestedGenres: readonly string[];
  suggestedMood: readonly string[];
  suggestedKeywords: readonly string[];
  issues: readonly string[];
  metadata: Readonly<Record<string, unknown>>;
}>;

export type MetadataPredictiveIssue = Readonly<{
  platform: MetadataDspName;
  issue: string;
  severity: "low" | "medium" | "high" | "critical";
  scoreImpact: number;
  metadata: Readonly<Record<string, unknown>>;
}>;

export type MetadataProfileRuleSet = Readonly<{
  titleRules: readonly string[];
  subtitleRules: readonly string[];
  versionRules: readonly string[];
  artistRules: readonly string[];
  featuredArtistRules: readonly string[];
  albumRules: readonly string[];
  languageRules: readonly string[];
  genreRules: readonly string[];
  moodRules: readonly string[];
  copyrightRules: readonly string[];
  publishingRules: readonly string[];
  artworkRules: readonly string[];
  lyricsRules: readonly string[];
  explicitContentRules: readonly string[];
  releaseDateRules: readonly string[];
  territoryRules: readonly string[];
  identifierRules: readonly string[];
  deliveryRules: readonly string[];
}>;

export type MetadataDspProfile = Readonly<{
  platform: MetadataDspName;
  displayName: string;
  titleCase: boolean;
  preserveSubtitleCase: boolean;
  allowFeaturingInTitle: boolean;
  allowEmoji: boolean;
  maxTitleLength: number;
  maxSubtitleLength: number;
  maxArtistLength: number;
  maxGenreLength: number;
  identifierRequirements: readonly string[];
  supportedReleaseKinds: readonly UniversalReleaseKind[];
  supportedLanguages: readonly string[];
  supportedTerritories: readonly string[];
  genreMap: Readonly<Record<string, string>>;
  moodMap: Readonly<Record<string, string>>;
  ruleSet: MetadataProfileRuleSet;
  deliveryHints: readonly string[];
  metadata: Readonly<Record<string, unknown>>;
}>;

export type MetadataIntelligenceReport = Readonly<{
  generatedAt: string;
  releaseId: string;
  trackId: string | null;
  versionId: string;
  universalRelease: UniversalRelease;
  validation: UniversalValidationResult;
  quality: MetadataQualityScore;
  compatibility: readonly MetadataCompatibilityScore[];
  recommendations: readonly MetadataRecommendation[];
  conflicts: readonly MetadataConflict[];
  history: readonly MetadataVersionRecord[];
  metadata: Readonly<Record<string, unknown>>;
}>;

export type MetadataIntelligenceEngineInput = Readonly<{
  releaseId: string;
  trackId?: string | null;
  actor?: string | null;
  correlationId?: string | null;
  metadata?: Readonly<Record<string, unknown>>;
}>;

export type MetadataIntelligenceRepairInput = MetadataIntelligenceEngineInput & Readonly<{
  release: DistributionRelease;
  track?: DistributionTrack | null;
}>;

export type MetadataIntelligenceNormalizationInput = MetadataIntelligenceRepairInput;

