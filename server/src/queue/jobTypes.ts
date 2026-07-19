import type { DistributionJob as ExistingDistributionJob, DistributionRelease, DistributionTrack } from "../distribution/models/distributionTypes";
import type { CalculateTrackRevenueInput } from "../royalties/models/royaltyTypes";
import type { NormalizedStreamEvent } from "../ingestion/streams";
import type { RealtimeEvent } from "../realtime/events/realtimeTypes";
import type { AudioProcessingInput, ArtworkProcessingInput } from "../media/models";
import type { RightsDspName } from "../distribution/rights";
import type { BackupScope } from "../distribution/backup";
import type {
  RoyaltyAdjustmentInput,
  RoyaltyCalculationInput,
  RoyaltyChargebackInput,
  RoyaltyConversionInput,
  RoyaltyForecastRequest,
  RoyaltyReserveInput,
  RoyaltyStatementRequest,
  RoyaltyTaxInput,
} from "../royalties/accounting/royaltyAccountingTypes";

export type SourceSystem =
  | "api"
  | "onboarding"
  | "distribution"
  | "royalties"
  | "fraud"
  | "analytics"
  | "realtime"
  | "media"
  | "metadata"
  | "review"
  | "rights"
  | "validation"
  | "campaign"
  | "worker"
  | "system";

export type JobTrace = {
  traceId: string;
  correlationId: string;
  actorUserId: string | null;
  sourceSystem: SourceSystem;
  createdAt: string;
  idempotencyKey: string;
  jobId?: string | null;
  releaseId?: string | null;
};

export type QueueJob<TPayload extends Record<string, unknown>> = JobTrace & TPayload;

export type EmailJob = QueueJob<{
  emailQueueId: string;
  to: string;
  subject: string;
  html: string;
  text?: string | null;
  templateType: string;
  payload: Record<string, unknown>;
}>;

export type DistributionJob = QueueJob<{
  distributionJob: ExistingDistributionJob;
}>;

export type ReviewQueueJob = QueueJob<{
  releaseId: string;
  queueId?: string | null;
  stage?: string | null;
  reason?: string | null;
}>;

export type FraudReviewQueueJob = QueueJob<{
  releaseId: string;
  trackId?: string | null;
  reason?: string | null;
  riskHint?: string | null;
}>;

export type DeliveryQueueJob = QueueJob<{
  releaseId: string;
  trackId?: string | null;
  platform?: string | null;
  reason?: string | null;
}>;

export type RetryQueueJob = QueueJob<{
  deliveryQueueId?: string | null;
  queueName: string;
  jobId?: string | null;
  reason?: string | null;
}>;

export type BackupJob = QueueJob<{
  backupMode: "full" | "scheduled" | "manual";
  requestedBy?: string | null;
  reason?: string | null;
  retentionDays?: number | null;
  scheduledFor?: string | null;
  scopes?: readonly BackupScope[];
  metadata?: Readonly<Record<string, unknown>>;
}>;

export type IncrementalBackupJob = QueueJob<{
  previousBackupId?: string | null;
  requestedBy?: string | null;
  reason?: string | null;
  retentionDays?: number | null;
  scheduledFor?: string | null;
  scopes?: readonly BackupScope[];
  metadata?: Readonly<Record<string, unknown>>;
}>;

export type BackupVerificationJob = QueueJob<{
  backupId: string;
  requestedBy?: string | null;
  reason?: string | null;
  metadata?: Readonly<Record<string, unknown>>;
}>;

export type RestoreJob = QueueJob<{
  backupId: string;
  requestedBy?: string | null;
  reason?: string | null;
  targetPointInTime?: string | null;
  simulate?: boolean;
  scopes?: readonly BackupScope[];
  metadata?: Readonly<Record<string, unknown>>;
}>;

export type RecoveryAuditJob = QueueJob<{
  eventType?: "backup-created" | "backup-verified" | "restore-simulated" | "restore-completed" | "recovery-plan-generated" | "retention-pruned" | "integrity-check";
  backupId?: string | null;
  requestedBy?: string | null;
  reason?: string | null;
  details?: Readonly<Record<string, unknown>>;
  metadata?: Readonly<Record<string, unknown>>;
}>;

export type SpotifyDeliveryJob = QueueJob<{
  releaseId: string;
  trackId?: string | null;
  reason?: string | null;
  connectorId?: "Spotify";
  release?: import("../distribution/domain").Release | null;
  packageModel?: import("../distribution/core/deliveryPackage").DeliveryPackage | null;
}>;

export type SpotifyPollingJob = QueueJob<{
  releaseId: string;
  trackId?: string | null;
  connectorId?: "Spotify";
  release?: import("../distribution/domain").Release | null;
  packageModel?: import("../distribution/core/deliveryPackage").DeliveryPackage | null;
}>;

export type SpotifyRetryJob = QueueJob<{
  releaseId: string;
  trackId?: string | null;
  deliveryQueueId?: string | null;
  connectorId?: "Spotify";
  reason?: string | null;
  release?: import("../distribution/domain").Release | null;
  packageModel?: import("../distribution/core/deliveryPackage").DeliveryPackage | null;
}>;

export type SpotifyHealthJob = QueueJob<{
  connectorId?: "Spotify";
  reason?: string | null;
  release?: import("../distribution/domain").Release | null;
  packageModel?: import("../distribution/core/deliveryPackage").DeliveryPackage | null;
}>;

export type SpotifyWebhookJob = QueueJob<{
  connectorId?: "Spotify";
  releaseId: string;
  eventType: string;
  source?: string | null;
  payload?: Readonly<Record<string, unknown>>;
  headers?: Readonly<Record<string, string>>;
  signatureValid?: boolean;
  release?: import("../distribution/domain").Release | null;
  packageModel?: import("../distribution/core/deliveryPackage").DeliveryPackage | null;
}>;

export type AppleMusicDeliveryJob = QueueJob<{
  releaseId: string;
  trackId?: string | null;
  reason?: string | null;
  connectorId?: "AppleMusic";
  release?: import("../distribution/domain").Release | null;
  packageModel?: import("../distribution/core/deliveryPackage").DeliveryPackage | null;
}>;

export type AppleMusicPollingJob = QueueJob<{
  releaseId: string;
  trackId?: string | null;
  connectorId?: "AppleMusic";
  release?: import("../distribution/domain").Release | null;
  packageModel?: import("../distribution/core/deliveryPackage").DeliveryPackage | null;
}>;

export type AppleMusicRetryJob = QueueJob<{
  releaseId: string;
  trackId?: string | null;
  deliveryQueueId?: string | null;
  connectorId?: "AppleMusic";
  reason?: string | null;
  release?: import("../distribution/domain").Release | null;
  packageModel?: import("../distribution/core/deliveryPackage").DeliveryPackage | null;
}>;

export type AppleMusicWebhookJob = QueueJob<{
  connectorId?: "AppleMusic";
  releaseId: string;
  eventType: string;
  source?: string | null;
  payload?: Readonly<Record<string, unknown>>;
  headers?: Readonly<Record<string, string>>;
  signatureValid?: boolean;
  release?: import("../distribution/domain").Release | null;
  packageModel?: import("../distribution/core/deliveryPackage").DeliveryPackage | null;
}>;

export type AppleMusicHealthJob = QueueJob<{
  connectorId?: "AppleMusic";
  reason?: string | null;
  release?: import("../distribution/domain").Release | null;
  packageModel?: import("../distribution/core/deliveryPackage").DeliveryPackage | null;
}>;

export type YouTubeDeliveryJob = QueueJob<{
  releaseId: string;
  trackId?: string | null;
  reason?: string | null;
  connectorId?: "YouTubeMusic";
  release?: import("../distribution/domain").Release | null;
  packageModel?: import("../distribution/core/deliveryPackage").DeliveryPackage | null;
}>;

export type YouTubePollingJob = QueueJob<{
  releaseId: string;
  trackId?: string | null;
  connectorId?: "YouTubeMusic";
  release?: import("../distribution/domain").Release | null;
  packageModel?: import("../distribution/core/deliveryPackage").DeliveryPackage | null;
}>;

export type YouTubeRetryJob = QueueJob<{
  releaseId: string;
  trackId?: string | null;
  deliveryQueueId?: string | null;
  connectorId?: "YouTubeMusic";
  reason?: string | null;
  release?: import("../distribution/domain").Release | null;
  packageModel?: import("../distribution/core/deliveryPackage").DeliveryPackage | null;
}>;

export type YouTubeWebhookJob = QueueJob<{
  connectorId?: "YouTubeMusic";
  releaseId: string;
  eventType: string;
  source?: string | null;
  payload?: Readonly<Record<string, unknown>>;
  headers?: Readonly<Record<string, string>>;
  signatureValid?: boolean;
  release?: import("../distribution/domain").Release | null;
  packageModel?: import("../distribution/core/deliveryPackage").DeliveryPackage | null;
}>;

export type YouTubeHealthJob = QueueJob<{
  connectorId?: "YouTubeMusic";
  reason?: string | null;
  release?: import("../distribution/domain").Release | null;
  packageModel?: import("../distribution/core/deliveryPackage").DeliveryPackage | null;
}>;

export type YouTubeContentIdJob = QueueJob<{
  connectorId?: "YouTubeMusic";
  releaseId: string;
  trackId?: string | null;
  assetId?: string | null;
  referenceType?: "audio" | "video" | "fingerprint";
  claimId?: string | null;
  policyId?: string | null;
  operation?: "SYNC_REFERENCE" | "UPDATE_OWNERSHIP" | "RESOLVE_CLAIM" | "WITHDRAW_REFERENCE" | "RESTORE_REFERENCE" | "HEALTH_CHECK";
  reason?: string | null;
  release?: import("../distribution/domain").Release | null;
  packageModel?: import("../distribution/core/deliveryPackage").DeliveryPackage | null;
}>;

export type AmazonMusicDeliveryJob = QueueJob<{
  releaseId: string;
  trackId?: string | null;
  reason?: string | null;
  connectorId?: "AmazonMusic";
  release?: import("../distribution/domain").Release | null;
  packageModel?: import("../distribution/core/deliveryPackage").DeliveryPackage | null;
}>;

export type AmazonMusicPollingJob = QueueJob<{
  releaseId: string;
  trackId?: string | null;
  connectorId?: "AmazonMusic";
  release?: import("../distribution/domain").Release | null;
  packageModel?: import("../distribution/core/deliveryPackage").DeliveryPackage | null;
}>;

export type AmazonMusicRetryJob = QueueJob<{
  releaseId: string;
  trackId?: string | null;
  deliveryQueueId?: string | null;
  connectorId?: "AmazonMusic";
  reason?: string | null;
  release?: import("../distribution/domain").Release | null;
  packageModel?: import("../distribution/core/deliveryPackage").DeliveryPackage | null;
}>;

export type AmazonMusicWebhookJob = QueueJob<{
  connectorId?: "AmazonMusic";
  releaseId: string;
  eventType: string;
  source?: string | null;
  payload?: Readonly<Record<string, unknown>>;
  headers?: Readonly<Record<string, string>>;
  signatureValid?: boolean;
  release?: import("../distribution/domain").Release | null;
  packageModel?: import("../distribution/core/deliveryPackage").DeliveryPackage | null;
}>;

export type AmazonMusicHealthJob = QueueJob<{
  connectorId?: "AmazonMusic";
  reason?: string | null;
  release?: import("../distribution/domain").Release | null;
  packageModel?: import("../distribution/core/deliveryPackage").DeliveryPackage | null;
}>;

export type DeezerDeliveryJob = QueueJob<{
  releaseId: string;
  trackId?: string | null;
  reason?: string | null;
  connectorId?: "Deezer";
  release?: import("../distribution/domain").Release | null;
  packageModel?: import("../distribution/core/deliveryPackage").DeliveryPackage | null;
}>;

export type DeezerPollingJob = QueueJob<{
  releaseId: string;
  trackId?: string | null;
  connectorId?: "Deezer";
  release?: import("../distribution/domain").Release | null;
  packageModel?: import("../distribution/core/deliveryPackage").DeliveryPackage | null;
}>;

export type DeezerRetryJob = QueueJob<{
  releaseId: string;
  trackId?: string | null;
  deliveryQueueId?: string | null;
  connectorId?: "Deezer";
  reason?: string | null;
  release?: import("../distribution/domain").Release | null;
  packageModel?: import("../distribution/core/deliveryPackage").DeliveryPackage | null;
}>;

export type DeezerWebhookJob = QueueJob<{
  connectorId?: "Deezer";
  releaseId: string;
  eventType: string;
  source?: string | null;
  payload?: Readonly<Record<string, unknown>>;
  headers?: Readonly<Record<string, string>>;
  signatureValid?: boolean;
  release?: import("../distribution/domain").Release | null;
  packageModel?: import("../distribution/core/deliveryPackage").DeliveryPackage | null;
}>;

export type DeezerHealthJob = QueueJob<{
  connectorId?: "Deezer";
  reason?: string | null;
  release?: import("../distribution/domain").Release | null;
  packageModel?: import("../distribution/core/deliveryPackage").DeliveryPackage | null;
}>;

export type TidalDeliveryJob = QueueJob<{
  releaseId: string;
  trackId?: string | null;
  reason?: string | null;
  connectorId?: "Tidal";
  release?: import("../distribution/domain").Release | null;
  packageModel?: import("../distribution/core/deliveryPackage").DeliveryPackage | null;
}>;

export type TidalPollingJob = QueueJob<{
  releaseId: string;
  trackId?: string | null;
  connectorId?: "Tidal";
  release?: import("../distribution/domain").Release | null;
  packageModel?: import("../distribution/core/deliveryPackage").DeliveryPackage | null;
}>;

export type TidalRetryJob = QueueJob<{
  releaseId: string;
  trackId?: string | null;
  deliveryQueueId?: string | null;
  connectorId?: "Tidal";
  reason?: string | null;
  release?: import("../distribution/domain").Release | null;
  packageModel?: import("../distribution/core/deliveryPackage").DeliveryPackage | null;
}>;

export type TidalWebhookJob = QueueJob<{
  connectorId?: "Tidal";
  releaseId: string;
  eventType: string;
  source?: string | null;
  payload?: Readonly<Record<string, unknown>>;
  headers?: Readonly<Record<string, string>>;
  signatureValid?: boolean;
  release?: import("../distribution/domain").Release | null;
  packageModel?: import("../distribution/core/deliveryPackage").DeliveryPackage | null;
}>;

export type TidalHealthJob = QueueJob<{
  connectorId?: "Tidal";
  reason?: string | null;
  release?: import("../distribution/domain").Release | null;
  packageModel?: import("../distribution/core/deliveryPackage").DeliveryPackage | null;
}>;

export type JioSaavnDeliveryJob = QueueJob<{
  releaseId: string;
  trackId?: string | null;
  reason?: string | null;
  connectorId?: "JioSaavn";
  release?: import("../distribution/domain").Release | null;
  packageModel?: import("../distribution/core/deliveryPackage").DeliveryPackage | null;
}>;

export type JioSaavnPollingJob = QueueJob<{
  releaseId: string;
  trackId?: string | null;
  connectorId?: "JioSaavn";
  release?: import("../distribution/domain").Release | null;
  packageModel?: import("../distribution/core/deliveryPackage").DeliveryPackage | null;
}>;

export type JioSaavnRetryJob = QueueJob<{
  releaseId: string;
  trackId?: string | null;
  deliveryQueueId?: string | null;
  connectorId?: "JioSaavn";
  reason?: string | null;
  release?: import("../distribution/domain").Release | null;
  packageModel?: import("../distribution/core/deliveryPackage").DeliveryPackage | null;
}>;

export type JioSaavnWebhookJob = QueueJob<{
  connectorId?: "JioSaavn";
  releaseId: string;
  eventType: string;
  source?: string | null;
  payload?: Readonly<Record<string, unknown>>;
  headers?: Readonly<Record<string, string>>;
  signatureValid?: boolean;
  release?: import("../distribution/domain").Release | null;
  packageModel?: import("../distribution/core/deliveryPackage").DeliveryPackage | null;
}>;

export type JioSaavnHealthJob = QueueJob<{
  connectorId?: "JioSaavn";
  reason?: string | null;
  release?: import("../distribution/domain").Release | null;
  packageModel?: import("../distribution/core/deliveryPackage").DeliveryPackage | null;
}>;

export type AnghamiDeliveryJob = QueueJob<{
  releaseId: string;
  trackId?: string | null;
  reason?: string | null;
  connectorId?: "Anghami";
  release?: import("../distribution/domain").Release | null;
  packageModel?: import("../distribution/core/deliveryPackage").DeliveryPackage | null;
}>;

export type AnghamiPollingJob = QueueJob<{
  releaseId: string;
  trackId?: string | null;
  connectorId?: "Anghami";
  release?: import("../distribution/domain").Release | null;
  packageModel?: import("../distribution/core/deliveryPackage").DeliveryPackage | null;
}>;

export type AnghamiRetryJob = QueueJob<{
  releaseId: string;
  trackId?: string | null;
  deliveryQueueId?: string | null;
  connectorId?: "Anghami";
  reason?: string | null;
  release?: import("../distribution/domain").Release | null;
  packageModel?: import("../distribution/core/deliveryPackage").DeliveryPackage | null;
}>;

export type AnghamiWebhookJob = QueueJob<{
  connectorId?: "Anghami";
  releaseId: string;
  eventType: string;
  source?: string | null;
  payload?: Readonly<Record<string, unknown>>;
  headers?: Readonly<Record<string, string>>;
  signatureValid?: boolean;
  release?: import("../distribution/domain").Release | null;
  packageModel?: import("../distribution/core/deliveryPackage").DeliveryPackage | null;
}>;

export type AnghamiHealthJob = QueueJob<{
  connectorId?: "Anghami";
  reason?: string | null;
  release?: import("../distribution/domain").Release | null;
  packageModel?: import("../distribution/core/deliveryPackage").DeliveryPackage | null;
}>;

export type BoomplayDeliveryJob = QueueJob<{
  releaseId: string;
  trackId?: string | null;
  reason?: string | null;
  connectorId?: "Boomplay";
  release?: import("../distribution/domain").Release | null;
  packageModel?: import("../distribution/core/deliveryPackage").DeliveryPackage | null;
}>;

export type BoomplayPollingJob = QueueJob<{
  releaseId: string;
  trackId?: string | null;
  connectorId?: "Boomplay";
  release?: import("../distribution/domain").Release | null;
  packageModel?: import("../distribution/core/deliveryPackage").DeliveryPackage | null;
}>;

export type BoomplayRetryJob = QueueJob<{
  releaseId: string;
  trackId?: string | null;
  deliveryQueueId?: string | null;
  connectorId?: "Boomplay";
  reason?: string | null;
  release?: import("../distribution/domain").Release | null;
  packageModel?: import("../distribution/core/deliveryPackage").DeliveryPackage | null;
}>;

export type BoomplayWebhookJob = QueueJob<{
  connectorId?: "Boomplay";
  releaseId: string;
  eventType: string;
  source?: string | null;
  payload?: Readonly<Record<string, unknown>>;
  headers?: Readonly<Record<string, string>>;
  signatureValid?: boolean;
  release?: import("../distribution/domain").Release | null;
  packageModel?: import("../distribution/core/deliveryPackage").DeliveryPackage | null;
}>;

export type BoomplayHealthJob = QueueJob<{
  connectorId?: "Boomplay";
  reason?: string | null;
  release?: import("../distribution/domain").Release | null;
  packageModel?: import("../distribution/core/deliveryPackage").DeliveryPackage | null;
}>;

export type TikTokDeliveryJob = QueueJob<{
  releaseId: string;
  trackId?: string | null;
  reason?: string | null;
  connectorId?: "TikTok";
  release?: import("../distribution/domain").Release | null;
  packageModel?: import("../distribution/core/deliveryPackage").DeliveryPackage | null;
}>;

export type TikTokPollingJob = QueueJob<{
  releaseId: string;
  trackId?: string | null;
  connectorId?: "TikTok";
  release?: import("../distribution/domain").Release | null;
  packageModel?: import("../distribution/core/deliveryPackage").DeliveryPackage | null;
}>;

export type TikTokRetryJob = QueueJob<{
  releaseId: string;
  trackId?: string | null;
  deliveryQueueId?: string | null;
  connectorId?: "TikTok";
  reason?: string | null;
  release?: import("../distribution/domain").Release | null;
  packageModel?: import("../distribution/core/deliveryPackage").DeliveryPackage | null;
}>;

export type TikTokWebhookJob = QueueJob<{
  connectorId?: "TikTok";
  releaseId: string;
  eventType: string;
  source?: string | null;
  payload?: Readonly<Record<string, unknown>>;
  headers?: Readonly<Record<string, string>>;
  signatureValid?: boolean;
  release?: import("../distribution/domain").Release | null;
  packageModel?: import("../distribution/core/deliveryPackage").DeliveryPackage | null;
}>;

export type TikTokHealthJob = QueueJob<{
  connectorId?: "TikTok";
  reason?: string | null;
  release?: import("../distribution/domain").Release | null;
  packageModel?: import("../distribution/core/deliveryPackage").DeliveryPackage | null;
}>;

export type MetaDeliveryJob = QueueJob<{
  releaseId: string;
  trackId?: string | null;
  reason?: string | null;
  connectorId?: "Meta";
  release?: import("../distribution/domain").Release | null;
  packageModel?: import("../distribution/core/deliveryPackage").DeliveryPackage | null;
}>;

export type MetaPollingJob = QueueJob<{
  releaseId: string;
  trackId?: string | null;
  connectorId?: "Meta";
  release?: import("../distribution/domain").Release | null;
  packageModel?: import("../distribution/core/deliveryPackage").DeliveryPackage | null;
}>;

export type MetaRetryJob = QueueJob<{
  releaseId: string;
  trackId?: string | null;
  deliveryQueueId?: string | null;
  connectorId?: "Meta";
  reason?: string | null;
  release?: import("../distribution/domain").Release | null;
  packageModel?: import("../distribution/core/deliveryPackage").DeliveryPackage | null;
}>;

export type MetaWebhookJob = QueueJob<{
  connectorId?: "Meta";
  releaseId: string;
  eventType: string;
  source?: string | null;
  payload?: Readonly<Record<string, unknown>>;
  headers?: Readonly<Record<string, string>>;
  signatureValid?: boolean;
  release?: import("../distribution/domain").Release | null;
  packageModel?: import("../distribution/core/deliveryPackage").DeliveryPackage | null;
}>;

export type MetaHealthJob = QueueJob<{
  connectorId?: "Meta";
  reason?: string | null;
  release?: import("../distribution/domain").Release | null;
  packageModel?: import("../distribution/core/deliveryPackage").DeliveryPackage | null;
}>;

export type MetadataValidationJob = QueueJob<{
  type: "VALIDATE_METADATA";
  releaseId: string;
  trackId?: string | null;
  release?: DistributionRelease | null;
  track?: DistributionTrack | null;
  metadata?: Readonly<Record<string, unknown>>;
}>;

export type MetadataNormalizationJob = QueueJob<{
  type: "NORMALIZE_METADATA";
  releaseId: string;
  trackId?: string | null;
  release?: DistributionRelease | null;
  track?: DistributionTrack | null;
  metadata?: Readonly<Record<string, unknown>>;
}>;

export type MetadataRepairJob = QueueJob<{
  type: "REPAIR_METADATA";
  releaseId: string;
  trackId?: string | null;
  release?: DistributionRelease | null;
  track?: DistributionTrack | null;
  metadata?: Readonly<Record<string, unknown>>;
}>;

export type MetadataRecommendationJob = QueueJob<{
  type: "RECOMMEND_METADATA";
  releaseId: string;
  trackId?: string | null;
  release?: DistributionRelease | null;
  track?: DistributionTrack | null;
  metadata?: Readonly<Record<string, unknown>>;
}>;

export type MetadataAuditJob = QueueJob<{
  type: "AUDIT_METADATA";
  releaseId?: string | null;
  trackId?: string | null;
  reportKind?: "metadata" | "compatibility" | "quality" | "identifier" | "release-readiness" | "recommendation";
  release?: DistributionRelease | null;
  track?: DistributionTrack | null;
  metadata?: Readonly<Record<string, unknown>>;
}>;

export type MetadataRetryJob = QueueJob<{
  type: "RETRY_METADATA";
  releaseId: string;
  trackId?: string | null;
  release?: DistributionRelease | null;
  track?: DistributionTrack | null;
  attempt?: number | null;
  error?: string | null;
  metadata?: Readonly<Record<string, unknown>>;
}>;

export type ReleaseSchedulerJob = QueueJob<{
  type: "SCHEDULE_RELEASE";
  releaseId: string;
  trackId?: string | null;
  scheduledFor?: string | Date | null;
  timezone?: string | null;
  embargoUntil?: string | Date | null;
  priority?: number | null;
  release?: DistributionRelease | null;
  track?: DistributionTrack | null;
  metadata?: Readonly<Record<string, unknown>>;
}>;

export type DeliveryOrchestrationJob = QueueJob<{
  type: "ORCHESTRATE_DELIVERY";
  releaseId: string;
  trackId?: string | null;
  targets?: readonly string[];
  parallel?: boolean;
  sequential?: boolean;
  batchId?: string | null;
  dependencyReleaseIds?: readonly string[];
  release?: DistributionRelease | null;
  track?: DistributionTrack | null;
  metadata?: Readonly<Record<string, unknown>>;
}>;

export type DeliveryRetryJob = QueueJob<{
  type: "RETRY_DELIVERY";
  releaseId: string;
  trackId?: string | null;
  deliveryAttemptId?: string | null;
  attempt?: number | null;
  error?: string | null;
  release?: DistributionRelease | null;
  track?: DistributionTrack | null;
  metadata?: Readonly<Record<string, unknown>>;
}>;

export type DeliveryRollbackJob = QueueJob<{
  type: "ROLLBACK_RELEASE";
  releaseId: string;
  trackId?: string | null;
  rollbackReason?: string | null;
  packageId?: string | null;
  release?: DistributionRelease | null;
  track?: DistributionTrack | null;
  metadata?: Readonly<Record<string, unknown>>;
}>;

export type ReleaseApprovalJob = QueueJob<{
  type: "APPROVE_RELEASE";
  releaseId: string;
  trackId?: string | null;
  approved?: boolean;
  approverId?: string | null;
  notes?: string | null;
  release?: DistributionRelease | null;
  track?: DistributionTrack | null;
  metadata?: Readonly<Record<string, unknown>>;
}>;

export type ReleaseAutomationJob = QueueJob<{
  type: "AUTOMATE_RELEASE";
  releaseId: string;
  trackId?: string | null;
  ruleName?: string | null;
  release?: DistributionRelease | null;
  track?: DistributionTrack | null;
  metadata?: Readonly<Record<string, unknown>>;
}>;

export type DeliveryAuditJob = QueueJob<{
  type: "AUDIT_DELIVERY";
  releaseId?: string | null;
  trackId?: string | null;
  reportKind?: "workflow" | "calendar" | "delivery" | "failure" | "retry" | "sla" | "automation" | "health";
  release?: DistributionRelease | null;
  track?: DistributionTrack | null;
  metadata?: Readonly<Record<string, unknown>>;
}>;

export type WebhookProcessingJob = QueueJob<{
  type: "PROCESS_WEBHOOK";
  releaseId: string;
  trackId?: string | null;
  source?: string | null;
  payload?: Readonly<Record<string, unknown>>;
  release?: DistributionRelease | null;
  track?: DistributionTrack | null;
  metadata?: Readonly<Record<string, unknown>>;
}>;

export type DeliveryHealthJob = QueueJob<{
  type: "CHECK_DELIVERY_HEALTH";
  releaseId?: string | null;
  trackId?: string | null;
  metadata?: Readonly<Record<string, unknown>>;
}>;

export type SlaJob = QueueJob<{
  type: "CHECK_SLA";
  releaseId?: string | null;
  trackId?: string | null;
  metadata?: Readonly<Record<string, unknown>>;
}>;

export type FingerprintJob = QueueJob<{
  type: "GENERATE_FINGERPRINT";
  releaseId: string;
  trackId?: string | null;
  assetId?: string | null;
  sourceUrl?: string | null;
  sampleRateHz?: number | null;
  release?: import("../distribution/models/distributionTypes").DistributionRelease | null;
  track?: import("../distribution/models/distributionTypes").DistributionTrack | null;
  metadata?: Readonly<Record<string, unknown>>;
}>;

export type DuplicateDetectionJob = QueueJob<{
  type: "FIND_DUPLICATES";
  releaseId: string;
  trackId?: string | null;
  assetId?: string | null;
  sourceUrl?: string | null;
  release?: import("../distribution/models/distributionTypes").DistributionRelease | null;
  track?: import("../distribution/models/distributionTypes").DistributionTrack | null;
  metadata?: Readonly<Record<string, unknown>>;
}>;

export type SimilarityJob = QueueJob<{
  type: "FIND_SIMILARITY";
  releaseId: string;
  trackId?: string | null;
  assetId?: string | null;
  sourceUrl?: string | null;
  release?: import("../distribution/models/distributionTypes").DistributionRelease | null;
  track?: import("../distribution/models/distributionTypes").DistributionTrack | null;
  metadata?: Readonly<Record<string, unknown>>;
}>;

export type AudioFraudJob = QueueJob<{
  type: "DETECT_AUDIO_FRAUD";
  releaseId: string;
  trackId?: string | null;
  assetId?: string | null;
  sourceUrl?: string | null;
  release?: import("../distribution/models/distributionTypes").DistributionRelease | null;
  track?: import("../distribution/models/distributionTypes").DistributionTrack | null;
  reason?: string | null;
  metadata?: Readonly<Record<string, unknown>>;
}>;

export type FingerprintRetryJob = QueueJob<{
  type: "RETRY_FINGERPRINT";
  releaseId: string;
  trackId?: string | null;
  assetId?: string | null;
  sourceUrl?: string | null;
  attempt?: number | null;
  error?: string | null;
  release?: import("../distribution/models/distributionTypes").DistributionRelease | null;
  track?: import("../distribution/models/distributionTypes").DistributionTrack | null;
  metadata?: Readonly<Record<string, unknown>>;
}>;

export type FingerprintAuditJob = QueueJob<{
  type: "AUDIT_FINGERPRINT";
  releaseId?: string | null;
  trackId?: string | null;
  fingerprintId?: string | null;
  reportKind?: "fingerprint" | "duplicate" | "similarity" | "fraud" | "catalog-duplicate";
  release?: import("../distribution/models/distributionTypes").DistributionRelease | null;
  track?: import("../distribution/models/distributionTypes").DistributionTrack | null;
  metadata?: Readonly<Record<string, unknown>>;
}>;

export type WithdrawalQueueJob = QueueJob<{
  releaseId: string;
  trackId?: string | null;
  reason?: string | null;
}>;

export type TakedownQueueJob = QueueJob<{
  releaseId: string;
  trackId?: string | null;
  reason?: string | null;
}>;

export type AuditQueueJob = QueueJob<{
  aggregateType: string;
  aggregateId?: string | null;
  action: string;
  oldValue?: unknown;
  newValue?: unknown;
  reason?: string | null;
}>;

export type ValidationQueueJob = QueueJob<{
  releaseId: string;
  validationType?: string | null;
  reason?: string | null;
}>;

export type RoyaltyJob = QueueJob<{
  type: "TRACK_REVENUE_RECALCULATION";
  input: CalculateTrackRevenueInput;
}>;

export type RoyaltyCalculationJob = QueueJob<{
  type: "CALCULATE_ROYALTIES";
  input: RoyaltyCalculationInput;
}>;

export type RoyaltyStatementJob = QueueJob<{
  type: "GENERATE_STATEMENT";
  input: RoyaltyStatementRequest;
}>;

export type RoyaltyCurrencyJob = QueueJob<{
  type: "CONVERT_CURRENCY";
  input: RoyaltyConversionInput;
}>;

export type RoyaltyTaxJob = QueueJob<{
  type: "CALCULATE_TAXES";
  input: RoyaltyTaxInput;
}>;

export type RoyaltyReserveJob = QueueJob<{
  type: "APPLY_RESERVE";
  input: RoyaltyReserveInput;
}>;

export type RoyaltyAdjustmentJob = QueueJob<{
  type: "APPLY_ADJUSTMENT";
  input: RoyaltyAdjustmentInput;
}>;

export type RoyaltyPaymentJob = QueueJob<{
  type: "RELEASE_PAYMENT";
  statementId: string;
  approverId: string;
  scheduledFor?: string | null;
  metadata?: Record<string, unknown>;
}>;

export type RoyaltyForecastJob = QueueJob<{
  type: "GENERATE_FORECAST";
  input: RoyaltyForecastRequest;
}>;

export type RoyaltyAuditJob = QueueJob<{
  type: "GENERATE_AUDIT_REPORT";
  currency: string;
  payeeId?: string | null;
}>;

export type RoyaltyRetryJob = QueueJob<{
  type: "RETRY_ROYALTY_JOB";
  queueName: string;
  jobId?: string | null;
  reason?: string | null;
  metadata?: Record<string, unknown>;
}>;

export type FraudJob = QueueJob<{
  type: "STREAM_EVENT_SCORE" | "ROYALTY_SPIKE_SCORE" | "DISTRIBUTION_ANOMALY_SCORE";
  streamEvent?: NormalizedStreamEvent;
  royaltySpike?: {
    trackId: string;
    platform: string;
    revenueLastDay: number;
    streamsLastDay: number;
  };
  distributionAnomaly?: {
    trackId: string;
    failuresLastDay: number;
  };
  reason?: string | null;
}>;

export type RightsQueueJob = QueueJob<{
  releaseId: string;
  trackId?: string | null;
  reason?: string | null;
  actor?: string | null;
  correlationId?: string | null;
  ipAddress?: string | null;
  territories?: readonly string[];
  dsp?: RightsDspName | null;
  metadata?: Record<string, unknown>;
}>;

export type AnalyticsJob = QueueJob<{
  type: "STREAM_ANALYTICS_REFRESH" | "REVENUE_ANALYTICS_REFRESH" | "FRAUD_ANALYTICS_REFRESH" | "DISTRIBUTION_ANALYTICS_REFRESH";
  artistId?: string | null;
  platform?: string | null;
  metadata?: Record<string, unknown>;
}>;

export type RealtimeJob = QueueJob<{
  type: "PUBLISH_EVENT" | "DASHBOARD_SNAPSHOT_REFRESH";
  event?: RealtimeEvent;
  artistId?: string | null;
}>;

export type PayoutJob = QueueJob<{
  payout_id: string;
  correlation_id: string;
  actor?: string | null;
}>;

export type MediaProcessingJob = QueueJob<{
  type: "PROCESS_AUDIO";
  input: AudioProcessingInput;
}>;

export type ArtworkProcessingJob = QueueJob<{
  type: "PROCESS_ARTWORK";
  input: ArtworkProcessingInput;
}>;

export type WaveformGenerationJob = QueueJob<{
  type: "GENERATE_WAVEFORM";
  input: AudioProcessingInput;
}>;

export type FingerprintAnalysisJob = QueueJob<{
  type: "ANALYZE_FINGERPRINT";
  input: AudioProcessingInput;
}>;

export type DeadLetterJob<TPayload extends Record<string, unknown> = Record<string, unknown>> = {
  queueName: string;
  jobName: string;
  jobId?: string;
  payload: TPayload;
  retries: number;
  failureReason: string;
  stackTrace?: string | null;
  failedAt: string;
  traceId?: string | null;
  correlationId?: string | null;
  actorUserId?: string | null;
};

export type QueueJobMap = {
  emailQueue: EmailJob;
  backupQueue: BackupJob;
  incrementalBackupQueue: IncrementalBackupJob;
  restoreQueue: RestoreJob;
  backupVerificationQueue: BackupVerificationJob;
  recoveryAuditQueue: RecoveryAuditJob;
  distributionQueue: DistributionJob;
  reviewQueue: ReviewQueueJob;
  fraudReviewQueue: FraudReviewQueueJob;
  deliveryQueue: DeliveryQueueJob;
  retryQueue: RetryQueueJob;
  withdrawQueue: WithdrawalQueueJob;
  takedownQueue: TakedownQueueJob;
  spotifyDeliveryQueue: SpotifyDeliveryJob;
  spotifyPollingQueue: SpotifyPollingJob;
  spotifyRetryQueue: SpotifyRetryJob;
  spotifyWebhookQueue: SpotifyWebhookJob;
  spotifyHealthQueue: SpotifyHealthJob;
  youtubeDeliveryQueue: YouTubeDeliveryJob;
  youtubePollingQueue: YouTubePollingJob;
  youtubeRetryQueue: YouTubeRetryJob;
  youtubeWebhookQueue: YouTubeWebhookJob;
  youtubeHealthQueue: YouTubeHealthJob;
  youtubeContentIdQueue: YouTubeContentIdJob;
  amazonMusicDeliveryQueue: AmazonMusicDeliveryJob;
  amazonMusicPollingQueue: AmazonMusicPollingJob;
  amazonMusicRetryQueue: AmazonMusicRetryJob;
  amazonMusicWebhookQueue: AmazonMusicWebhookJob;
  amazonMusicHealthQueue: AmazonMusicHealthJob;
  deezerDeliveryQueue: DeezerDeliveryJob;
  deezerPollingQueue: DeezerPollingJob;
  deezerRetryQueue: DeezerRetryJob;
  deezerWebhookQueue: DeezerWebhookJob;
  deezerHealthQueue: DeezerHealthJob;
  tidalDeliveryQueue: TidalDeliveryJob;
  tidalPollingQueue: TidalPollingJob;
  tidalRetryQueue: TidalRetryJob;
  tidalWebhookQueue: TidalWebhookJob;
  tidalHealthQueue: TidalHealthJob;
  jioSaavnDeliveryQueue: JioSaavnDeliveryJob;
  jioSaavnPollingQueue: JioSaavnPollingJob;
  jioSaavnRetryQueue: JioSaavnRetryJob;
  jioSaavnWebhookQueue: JioSaavnWebhookJob;
  jioSaavnHealthQueue: JioSaavnHealthJob;
  anghamiDeliveryQueue: AnghamiDeliveryJob;
  anghamiPollingQueue: AnghamiPollingJob;
  anghamiRetryQueue: AnghamiRetryJob;
  anghamiWebhookQueue: AnghamiWebhookJob;
  anghamiHealthQueue: AnghamiHealthJob;
  boomplayDeliveryQueue: BoomplayDeliveryJob;
  boomplayPollingQueue: BoomplayPollingJob;
  boomplayRetryQueue: BoomplayRetryJob;
  boomplayWebhookQueue: BoomplayWebhookJob;
  boomplayHealthQueue: BoomplayHealthJob;
  tiktokDeliveryQueue: TikTokDeliveryJob;
  tiktokPollingQueue: TikTokPollingJob;
  tiktokRetryQueue: TikTokRetryJob;
  tiktokWebhookQueue: TikTokWebhookJob;
  tiktokHealthQueue: TikTokHealthJob;
  metaDeliveryQueue: MetaDeliveryJob;
  metaPollingQueue: MetaPollingJob;
  metaRetryQueue: MetaRetryJob;
  metaWebhookQueue: MetaWebhookJob;
  metaHealthQueue: MetaHealthJob;
  appleMusicDeliveryQueue: AppleMusicDeliveryJob;
  appleMusicPollingQueue: AppleMusicPollingJob;
  appleMusicRetryQueue: AppleMusicRetryJob;
  appleMusicWebhookQueue: AppleMusicWebhookJob;
  appleMusicHealthQueue: AppleMusicHealthJob;
  metadataValidationQueue: MetadataValidationJob;
  metadataNormalizationQueue: MetadataNormalizationJob;
  metadataRepairQueue: MetadataRepairJob;
  metadataRecommendationQueue: MetadataRecommendationJob;
  metadataAuditQueue: MetadataAuditJob;
  metadataRetryQueue: MetadataRetryJob;
  releaseSchedulerQueue: ReleaseSchedulerJob;
  deliveryOrchestrationQueue: DeliveryOrchestrationJob;
  deliveryRetryQueue: DeliveryRetryJob;
  rollbackQueue: DeliveryRollbackJob;
  approvalQueue: ReleaseApprovalJob;
  automationQueue: ReleaseAutomationJob;
  deliveryAuditQueue: DeliveryAuditJob;
  deliveryWebhookQueue: WebhookProcessingJob;
  deliveryHealthQueue: DeliveryHealthJob;
  slaQueue: SlaJob;
  fingerprintQueue: FingerprintJob;
  duplicateQueue: DuplicateDetectionJob;
  similarityQueue: SimilarityJob;
  audioFraudQueue: AudioFraudJob;
  fingerprintRetryQueue: FingerprintRetryJob;
  fingerprintAuditQueue: FingerprintAuditJob;
  auditQueue: AuditQueueJob;
  validationQueue: ValidationQueueJob;
  royaltyQueue: RoyaltyJob;
  fraudQueue: FraudJob;
  rightsValidationQueue: RightsQueueJob;
  rightsTerritorySyncQueue: RightsQueueJob;
  rightsConflictQueue: RightsQueueJob;
  rightsWithdrawalQueue: RightsQueueJob;
  rightsLicenseExpirationQueue: RightsQueueJob;
  rightsAuditQueue: RightsQueueJob;
  analyticsQueue: AnalyticsJob;
  realtimeQueue: RealtimeJob;
  payoutQueue: PayoutJob;
  "media-processing": MediaProcessingJob;
  "artwork-processing": ArtworkProcessingJob;
  "waveform-generation": WaveformGenerationJob;
  "fingerprint-analysis": FingerprintAnalysisJob;
  royaltyCalculationQueue: RoyaltyCalculationJob;
  statementQueue: RoyaltyStatementJob;
  currencyQueue: RoyaltyCurrencyJob;
  taxQueue: RoyaltyTaxJob;
  reserveQueue: RoyaltyReserveJob;
  adjustmentQueue: RoyaltyAdjustmentJob;
  paymentQueue: RoyaltyPaymentJob;
  forecastQueue: RoyaltyForecastJob;
  royaltyAuditQueue: RoyaltyAuditJob;
  royaltyRetryQueue: RoyaltyRetryJob;
};

export function createJobTrace(input: Partial<JobTrace> & { idempotencyKey: string; sourceSystem?: SourceSystem }): Pick<JobTrace, "traceId" | "correlationId" | "actorUserId" | "sourceSystem" | "createdAt" | "idempotencyKey"> {
  const now = new Date().toISOString();
  const traceId = input.traceId || input.correlationId || input.idempotencyKey;
  return {
    traceId,
    correlationId: input.correlationId || traceId,
    actorUserId: input.actorUserId ?? null,
    sourceSystem: input.sourceSystem || "system",
    createdAt: input.createdAt || now,
    idempotencyKey: input.idempotencyKey,
  };
}
