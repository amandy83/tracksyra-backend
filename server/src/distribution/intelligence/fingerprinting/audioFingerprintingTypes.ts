import type { DistributionRelease, DistributionTrack } from "../../models/distributionTypes";

export type AudioFingerprintFeatureVector = Readonly<{
  waveformSignature: readonly number[];
  spectralSignature: readonly number[];
  mfccSignature: readonly number[];
  tempoSignature: readonly number[];
  rhythmSignature: readonly number[];
  frequencySignature: readonly number[];
}>;

export type AudioFingerprintMetrics = Readonly<{
  durationSeconds: number;
  sampleRateHz: number;
  channels: number;
  zeroCrossingRate: number;
  silenceRatio: number;
  dynamicRange: number;
  bpm: number;
  confidence: number;
}>;

export type AudioFingerprintRecord = Readonly<{
  fingerprintId: string;
  assetId: string | null;
  releaseId: string;
  trackId: string | null;
  generatedAt: string;
  acousticFingerprintHash: string;
  chromaprintCompatibleHash: string;
  waveformHash: string;
  spectralHash: string;
  tempoHash: string;
  rhythmHash: string;
  frequencyHash: string;
  overallHash: string;
  metrics: AudioFingerprintMetrics;
  features: AudioFingerprintFeatureVector;
  metadata: Readonly<Record<string, unknown>>;
}>;

export type AudioFingerprintComparison = Readonly<{
  similarityScore: number;
  confidenceScore: number;
  waveformSimilarity: number;
  spectralSimilarity: number;
  tempoSimilarity: number;
  pitchSimilarity: number;
  silenceSimilarity: number;
  dynamicRangeSimilarity: number;
  rhythmSimilarity: number;
  frequencySimilarity: number;
  duplicateType: DuplicateMatchKind | null;
  reasons: readonly string[];
}>;

export type DuplicateMatchKind =
  | "exact_duplicate"
  | "near_duplicate"
  | "remaster"
  | "radio_edit"
  | "extended_mix"
  | "instrumental"
  | "acapella"
  | "live_version"
  | "cover_version"
  | "remix"
  | "pitch_shifted"
  | "time_stretched"
  | "noise_altered"
  | "lossy_reencode"
  | "partial_upload"
  | "album_duplicate"
  | "cross_release_duplicate"
  | "cross_label_duplicate"
  | "cross_artist_duplicate"
  | "cross_catalog_duplicate"
  | "none";

export type AudioFingerprintDuplicateMatch = Readonly<{
  matchId: string;
  fingerprintId: string;
  releaseId: string;
  trackId: string | null;
  matchedReleaseId: string;
  matchedTrackId: string | null;
  matchedFingerprintId: string | null;
  duplicateType: DuplicateMatchKind;
  similarityScore: number;
  confidenceScore: number;
  reasons: readonly string[];
  evidence: Readonly<Record<string, unknown>>;
  createdAt: string;
}>;

export type AudioFingerprintSimilarityScore = Readonly<{
  similarityId: string;
  fingerprintId: string;
  releaseId: string;
  trackId: string | null;
  comparedReleaseId: string;
  comparedTrackId: string | null;
  waveformSimilarity: number;
  spectralSimilarity: number;
  tempoSimilarity: number;
  pitchSimilarity: number;
  silenceSimilarity: number;
  dynamicRangeSimilarity: number;
  rhythmSimilarity: number;
  frequencySimilarity: number;
  overallSimilarity: number;
  confidenceScore: number;
  createdAt: string;
}>;

export type AudioFraudSignal = Readonly<{
  code: string;
  severity: "low" | "medium" | "high" | "critical";
  scoreImpact: number;
  explanation: string;
  metadata: Readonly<Record<string, unknown>>;
}>;

export type AudioFingerprintJobInput = Readonly<{
  releaseId: string;
  trackId?: string | null;
  assetId?: string | null;
  sourceUrl?: string | null;
  pcmBuffer?: Buffer | null;
  sampleRateHz?: number | null;
  actor?: string | null;
  correlationId?: string | null;
  requestedBy?: string | null;
  metadata?: Readonly<Record<string, unknown>>;
}>;

export type AudioFingerprintGenerationResult = Readonly<{
  generatedAt: string;
  release: DistributionRelease | null;
  track: DistributionTrack | null;
  fingerprint: AudioFingerprintRecord | null;
  comparison: AudioFingerprintComparison | null;
  duplicates: readonly AudioFingerprintDuplicateMatch[];
  similarityScores: readonly AudioFingerprintSimilarityScore[];
  fraudSignals: readonly AudioFraudSignal[];
  reviewActions: readonly string[];
  rightsReferences: readonly string[];
  metadata: Readonly<Record<string, unknown>>;
}>;

export type AudioFingerprintReport = Readonly<{
  generatedAt: string;
  summary: Readonly<Record<string, unknown>>;
  items: readonly AudioFingerprintRecord[];
}>;

export type AudioDuplicateReport = Readonly<{
  generatedAt: string;
  summary: Readonly<Record<string, unknown>>;
  items: readonly AudioFingerprintDuplicateMatch[];
}>;

export type AudioSimilarityReport = Readonly<{
  generatedAt: string;
  summary: Readonly<Record<string, unknown>>;
  items: readonly AudioFingerprintSimilarityScore[];
}>;

export type AudioFraudReport = Readonly<{
  generatedAt: string;
  summary: Readonly<Record<string, unknown>>;
  items: readonly AudioFraudSignal[];
}>;

export type AudioRightsMatchReport = Readonly<{
  generatedAt: string;
  summary: Readonly<Record<string, unknown>>;
  items: readonly Readonly<Record<string, unknown>>[];
}>;

export type CatalogDuplicateReport = Readonly<{
  generatedAt: string;
  summary: Readonly<Record<string, unknown>>;
  items: readonly AudioFingerprintDuplicateMatch[];
}>;

export type FingerprintCapabilityMatrix = Readonly<{
  supportedAudioFormats: readonly string[];
  artworkRules: readonly string[];
  metadataLimits: Readonly<Record<string, unknown>>;
  genreMappings: Readonly<Record<string, string>>;
  languageMappings: Readonly<Record<string, string>>;
  parentalAdvisoryRules: readonly string[];
  territorySupport: readonly string[];
  deliveryProtocol: string;
  identifierRequirements: readonly string[];
  lyricsSupport: boolean;
  canvasSupport: boolean;
  dolbySupport: boolean;
  spatialAudioSupport: boolean;
  videoSupport: boolean;
}>;

