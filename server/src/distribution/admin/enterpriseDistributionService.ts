import type { DistributionIdGenerator } from "../idGenerator";
import type { DistributionStore, SqlExecutor } from "../services/distributionStore";
import type { DistributionRelease, DistributionTrack } from "../models/distributionTypes";
import { BackupDisasterRecoveryService } from "../backup";

export type EnterpriseAuditContext = Readonly<{
  actor: string;
  ipAddress: string | null;
  correlationId: string | null;
  reason: string | null;
}>;

export type EnterpriseReviewStage =
  | "Draft"
  | "Pending Review"
  | "Metadata Review"
  | "Copyright Review"
  | "Audio Review"
  | "Artwork Review"
  | "Fraud Review"
  | "Approved"
  | "Rejected"
  | "Returned for Changes"
  | "Released"
  | "Archived";

export type EnterpriseValidationEntry = Readonly<{
  validationType: string;
  status: string;
  details: Readonly<Record<string, unknown>>;
  createdAt: string;
}>;

export type EnterpriseDuplicateEntry = Readonly<{
  id: string;
  duplicateType: string;
  severity: string;
  details: Readonly<Record<string, unknown>>;
  createdAt: string;
}>;

export type EnterpriseCopyrightFlagEntry = Readonly<{
  id: string;
  suspiciousTitle: boolean;
  suspiciousArtist: boolean;
  suspiciousMetadata: boolean;
  reason: string | null;
  details: Readonly<Record<string, unknown>>;
  createdAt: string;
}>;

export type EnterpriseRightsReport = Readonly<{
  releaseId: string;
  release: DistributionRelease;
  tracks: readonly DistributionTrack[];
  stage: EnterpriseReviewStage;
  readinessScore: number;
  ownershipVerified: boolean;
  chainOfTitleVerified: boolean;
  rightsIssues: readonly string[];
  identifierIssues: readonly string[];
  moderationFlags: readonly string[];
  validation: readonly EnterpriseValidationEntry[];
  duplicates: readonly EnterpriseDuplicateEntry[];
  copyrightFlags: readonly EnterpriseCopyrightFlagEntry[];
  reviewQueue: EnterpriseReviewQueueItem | null;
  auditTrail: readonly EnterpriseAuditTrailEntry[];
}>;

export type EnterpriseReviewQueueItem = Readonly<{
  queueId: string;
  releaseId: string;
  title: string;
  primaryArtist: string;
  queueStatus: string;
  validationScore: number;
  priority: number;
  assignedAdmin: string | null;
  changeRequestNotes: string | null;
  escalationReason: string | null;
  firstReviewedAt: string | null;
  reviewedAt: string | null;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  stage: EnterpriseReviewStage;
}>;

export type EnterpriseFraudQueueItem = Readonly<{
  reviewId: string;
  fraudEventId: string;
  eventId: string;
  trackId: string | null;
  userId: string | null;
  platform: string | null;
  fraudScore: number;
  reasons: readonly string[];
  queuedAt: string;
  riskScore: number;
}>;

export type EnterpriseDeliveryQueueItem = Readonly<{
  jobId: string;
  releaseId: string;
  title: string;
  primaryArtist: string;
  platform: string;
  status: string;
  attempts: number;
  nextRetryAt: string | null;
  createdAt: string;
  lastAuditAction: string | null;
}>;

export type EnterpriseRoyaltyPeriodItem = Readonly<{
  periodId: string;
  periodType: string;
  periodStart: string;
  periodEnd: string;
  status: string;
  closedAt: string | null;
  publishedAt: string | null;
  statementCount: number;
  totalPayableAmount: number;
  currency: string | null;
}>;

export type EnterpriseAuditTrailEntry = Readonly<{
  source: string;
  entityId: string;
  action: string;
  status: string;
  actor: string;
  createdAt: string;
  metadata: Readonly<Record<string, unknown>>;
}>;

export type EnterpriseReportName =
  | "rejected-releases"
  | "duplicate-releases"
  | "rights-conflicts"
  | "delivery-failures"
  | "dsp-errors"
  | "royalty-exceptions"
  | "fraud-reports"
  | "fingerprint-reports"
  | "duplicate-report"
  | "similarity-report"
  | "audio-fraud-report"
  | "rights-match-report"
  | "catalog-duplicate-report"
  | "metadata-validation-report"
  | "metadata-quality-report"
  | "dsp-compatibility-report"
  | "publishing-report"
  | "rights-report"
  | "release-readiness-report"
  | "metadata-audit-report"
  | "identifier-report"
  | "release-calendar-report"
  | "delivery-report"
  | "delivery-failure-report"
  | "retry-report"
  | "sla-report"
  | "release-automation-report"
  | "workflow-report"
  | "delivery-health-report"
  | "health-report"
  | "capability-report"
  | "metadata-report"
  | "error-report"
  | "claim-report"
  | "asset-report"
  | "monetization-report"
  | "backup-report"
  | "restore-report"
  | "recovery-report"
  | "retention-report"
  | "integrity-verification-report"
  | "audit-reports";

export type EnterpriseDashboardName =
  | "overview"
  | "rights-review"
  | "fraud-review"
  | "content-review"
  | "dsp-queue"
  | "catalog-health"
  | "delivery-health"
  | "metadata-errors"
  | "fingerprint-dashboard"
  | "duplicate-dashboard"
  | "similarity-dashboard"
  | "audio-fraud-dashboard"
  | "catalog-duplicate-dashboard"
  | "metadata-dashboard"
  | "dsp-compatibility-dashboard"
  | "metadata-quality-dashboard"
  | "identifier-dashboard"
  | "release-readiness-dashboard"
  | "recommendation-dashboard"
  | "release-calendar-dashboard"
  | "delivery-dashboard"
  | "workflow-dashboard"
  | "automation-dashboard"
  | "retry-dashboard"
  | "sla-dashboard"
  | "release-health-dashboard"
  | "royalty-health"
  | "backup-dashboard"
  | "recovery-dashboard"
  | "storage-usage-dashboard"
  | "backup-health-panel"
  | "recovery-timeline";

export type EnterpriseOverview = Readonly<{
  generatedAt: string;
  pendingReviewCount: number;
  fraudQueueCount: number;
  failedDeliveryCount: number;
  openRoyaltyPeriodCount: number;
  validationFailureCount: number;
  duplicateReleaseCount: number;
  rightConflictCount: number;
}>;

export type EnterpriseReportResult = Readonly<{
  name: EnterpriseReportName;
  generatedAt: string;
  items: readonly unknown[];
  summary: Readonly<Record<string, unknown>>;
}>;

export type EnterpriseDashboardResult = Readonly<{
  name: EnterpriseDashboardName;
  generatedAt: string;
  summary: Readonly<Record<string, unknown>>;
  items: readonly unknown[];
}>;

export type EnterpriseIdentifierReport = Readonly<{
  releaseId: string;
  upc: string | null;
  upcMatches: readonly IdentifierMatch[];
  tracks: readonly TrackIdentifierReport[];
  duplicateIsrcMatches: readonly IdentifierMatch[];
  generatedUpc: string;
  generatedIsrcs: readonly string[];
}>;

export type TrackIdentifierReport = Readonly<{
  trackId: string;
  title: string;
  isrc: string | null;
  generatedIsrc: string;
  duplicateMatches: readonly IdentifierMatch[];
}>;

export type IdentifierMatch = Readonly<{
  id: string;
  title: string | null;
  source: string;
}>;

type ReviewQueueRow = Readonly<{
  id: string;
  release_id: string;
  queue_status: string;
  priority: number;
  assigned_admin: string | null;
  validation_score: number;
  change_request_notes: string | null;
  escalation_reason: string | null;
  first_reviewed_at: string | null;
  approved_at: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
  title?: string | null;
  primary_artist?: string | null;
}>;

type FraudReviewQueueRow = Readonly<{
  review_id: string;
  fraud_event_id: string;
  event_id: string;
  track_id: string | null;
  user_id: string | null;
  platform: string | null;
  fraud_score: number;
  reasons: unknown;
  queued_at: string;
}>;

type DistributionJobRow = Readonly<{
  id: string;
  release_id: string | null;
  track_id: string | null;
  platform: string;
  status: string;
  attempts: number | null;
  next_retry_at: string | null;
  created_at: string;
}>;

type RoyaltyPeriodRow = Readonly<{
  id: string;
  period_type: string;
  period_start: string;
  period_end: string;
  status: string;
  closed_at: string | null;
  published_at: string | null;
  statement_count: number | null;
  total_payable_amount: string | number | null;
  currency: string | null;
}>;

type AuditTrailRow = Readonly<{
  source: string;
  entity_id: string;
  action: string;
  status: string;
  actor: string;
  created_at: string;
  metadata: unknown;
}>;

type ValidationRow = Readonly<{
  validation_type: string;
  status: string;
  details: unknown;
  created_at: string;
}>;

type DuplicateRow = Readonly<{
  id: string;
  duplicate_type: string;
  severity: string;
  details: unknown;
  created_at: string;
}>;

type CopyrightFlagRow = Readonly<{
  id: string;
  suspicious_title: boolean;
  suspicious_artist: boolean;
  suspicious_metadata: boolean;
  reason: string | null;
  details: unknown;
  created_at: string;
}>;

type ReleaseDuplicateMatchRow = Readonly<{
  id: string;
  title: string | null;
}>;

type TrackDuplicateMatchRow = Readonly<{
  id: string;
  title: string | null;
}>;

function nowIso(): string {
  return new Date().toISOString();
}

function normalizeRecord(value: unknown): Readonly<Record<string, unknown>> {
  return value && typeof value === "object" ? Object.freeze({ ...(value as Record<string, unknown>) }) : Object.freeze({});
}

function normalizeStringArray(value: unknown): readonly string[] {
  if (!Array.isArray(value)) return Object.freeze([]);
  return Object.freeze(value.map((entry) => String(entry).trim()).filter(Boolean));
}

function normalizeMaybeString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function stageFromStatus(status: string | null | undefined): EnterpriseReviewStage {
  switch ((status ?? "").toLowerCase()) {
    case "draft":
    case "uploaded":
      return "Draft";
    case "under_review":
    case "validation_passed":
    case "pending":
    case "in_review":
      return "Pending Review";
    case "needs_changes":
      return "Returned for Changes";
    case "approved":
    case "queued_for_distribution":
    case "distributing":
      return "Approved";
    case "rejected":
    case "validation_failed":
      return "Rejected";
    case "live":
    case "sent_to_stores":
    case "processing":
    case "released":
      return "Released";
    case "archived":
    case "release_archived":
      return "Archived";
    default:
      return "Pending Review";
  }
}

function detectModerationFlags(values: readonly string[]): readonly string[] {
  const text = values.join(" ").toLowerCase();
  const flags: string[] = [];
  const patterns: Array<[string, RegExp]> = [
    ["hate_speech", /\b(hate|slur|genocide)\b/],
    ["terrorism", /\b(terror|terrorism|bomb|explosive)\b/],
    ["child_exploitation", /\b(child exploitation|minor explicit|underage|csam)\b/],
    ["malware", /\b(malware|ransomware|spyware|virus)\b/],
    ["spam", /\b(spam|botnet|clickfarm|click farm)\b/],
    ["fraud", /\b(fraud|scam|phishing|counterfeit)\b/],
    ["deepfake_abuse", /\bdeepfake\b/],
    ["ai_voice_cloning", /\b(voice cloning|ai voice|voice clone)\b/],
    ["impersonation", /\b(impersonat|fake artist|brand impersonation)\b/],
    ["duplicate_release", /\b(duplicate release|re-release|reupload)\b/],
    ["public_domain_misuse", /\b(public domain|pd misuse)\b/],
  ];

  for (const [flag, pattern] of patterns) {
    if (pattern.test(text)) flags.push(flag);
  }

  return Object.freeze(flags);
}

function moderationInput(release: DistributionRelease, tracks: readonly DistributionTrack[]): readonly string[] {
  const values: string[] = [
    release.title ?? "",
    release.primaryArtist ?? "",
    release.labelName ?? "",
    release.genre ?? "",
    release.subgenre ?? "",
    JSON.stringify(release.metadata ?? {}),
  ];
  for (const track of tracks) {
    values.push(
      track.title ?? "",
      track.primaryArtist ?? "",
      track.composer ?? "",
      track.author ?? "",
      track.publisher ?? "",
      track.genre ?? "",
      track.subgenre ?? "",
      track.secondaryGenre ?? "",
      track.secondarySubgenre ?? "",
      track.lyrics ?? "",
      JSON.stringify(track.metadata ?? {}),
    );
  }
  return Object.freeze(values.filter(Boolean));
}

function validationSeverityScore(rows: readonly { status: string }[]): number {
  let score = 100;
  for (const row of rows) {
    if (row.status === "failed") score -= 20;
    else if (row.status === "warning") score -= 8;
    else if (row.status === "pending") score -= 4;
  }
  return Math.max(0, score);
}

function queueStatusToStage(status: string): EnterpriseReviewStage {
  switch (status.toLowerCase()) {
    case "approved":
      return "Approved";
    case "rejected":
      return "Rejected";
    case "needs_changes":
      return "Returned for Changes";
    case "in_review":
      return "Pending Review";
    case "pending":
    default:
      return "Pending Review";
  }
}

export class EnterpriseDistributionService {
  constructor(
    private readonly sql: SqlExecutor,
    private readonly distributionStore: DistributionStore,
    private readonly identifierGenerator: DistributionIdGenerator,
  ) {}

  async generateIdentifiers(trackCount: number): Promise<{ upc: string; isrcs: readonly string[] }> {
    const bundle = await this.identifierGenerator.generateBundle(Math.max(0, Math.trunc(trackCount)));
    return Object.freeze({ upc: bundle.upc, isrcs: Object.freeze([...bundle.isrcs]) });
  }

  async getCatalogReport(releaseId: string): Promise<EnterpriseRightsReport | null> {
    const bundle = await this.distributionStore.getReleaseWithTracks(releaseId);
    if (!bundle) return null;

    const [validation, duplicates, copyrightFlags, reviewQueue, auditTrail] = await Promise.all([
      this.getValidationRows(releaseId),
      this.getDuplicateRows(releaseId),
      this.getCopyrightFlags(releaseId),
      this.getReviewQueueRow(releaseId),
      this.getAuditTrail(releaseId, 50),
    ]);
    const [upcMatches, trackIdentifierReport, duplicateIsrcMatches] = await this.getIdentifierReport(bundle.release, bundle.tracks);
    const moderationFlags = detectModerationFlags(moderationInput(bundle.release, bundle.tracks));
    const rightsIssues = this.collectRightsIssues(bundle.release, bundle.tracks, validation, duplicates, copyrightFlags, moderationFlags);
    const identifierIssues = this.collectIdentifierIssues(bundle.release, bundle.tracks, upcMatches, trackIdentifierReport, duplicateIsrcMatches);
    const ownershipVerified = this.isOwnershipVerified(bundle.release, bundle.tracks, rightsIssues, validation);
    const chainOfTitleVerified = ownershipVerified && rightsIssues.length === 0 && identifierIssues.length === 0;
    const stage = this.resolveStage(bundle.release.status ?? null, reviewQueue, validation, duplicates, copyrightFlags, moderationFlags);
    const readinessScore = this.calculateReadinessScore(validation, duplicates, copyrightFlags, moderationFlags, reviewQueue);

    return Object.freeze({
      releaseId,
      release: bundle.release,
      tracks: bundle.tracks,
      stage,
      readinessScore,
      ownershipVerified,
      chainOfTitleVerified,
      rightsIssues: Object.freeze(rightsIssues),
      identifierIssues: Object.freeze(identifierIssues),
      moderationFlags,
      validation,
      duplicates,
      copyrightFlags,
      reviewQueue,
      auditTrail,
    });
  }

  async getDashboard(name: EnterpriseDashboardName, limit = 50): Promise<EnterpriseDashboardResult> {
    switch (name) {
      case "overview":
        return Object.freeze({
          name,
          generatedAt: nowIso(),
          summary: await this.getOverview(),
          items: [],
        });
      case "rights-review":
        return Object.freeze({
          name,
          generatedAt: nowIso(),
          summary: { limit },
          items: await this.getRightsReviewQueue(limit),
        });
      case "fraud-review":
        return Object.freeze({
          name,
          generatedAt: nowIso(),
          summary: { limit },
          items: await this.getFraudQueue(limit),
        });
      case "content-review":
        return Object.freeze({
          name,
          generatedAt: nowIso(),
          summary: { limit },
          items: await this.getContentReviewQueue(limit),
        });
      case "dsp-queue":
        return Object.freeze({
          name,
          generatedAt: nowIso(),
          summary: { limit },
          items: await this.getDeliveryQueue(limit),
        });
      case "catalog-health":
        return Object.freeze({
          name,
          generatedAt: nowIso(),
          summary: await this.getCatalogHealth(),
          items: await this.getCatalogHealthItems(limit),
        });
      case "delivery-health":
        return Object.freeze({
          name,
          generatedAt: nowIso(),
          summary: await this.getDeliveryHealth(),
          items: await this.getDeliveryQueue(limit),
        });
      case "metadata-errors":
        return Object.freeze({
          name,
          generatedAt: nowIso(),
          summary: await this.getMetadataErrorSummary(),
          items: await this.getMetadataErrorItems(limit),
        });
      case "fingerprint-dashboard":
        return Object.freeze({
          name,
          generatedAt: nowIso(),
          summary: await this.getFingerprintReportSummary(),
          items: await this.getFingerprintReportItems(limit),
        });
      case "duplicate-dashboard":
        return Object.freeze({
          name,
          generatedAt: nowIso(),
          summary: await this.getDuplicateReportSummary(),
          items: await this.getDuplicateReportItems(limit),
        });
      case "similarity-dashboard":
        return Object.freeze({
          name,
          generatedAt: nowIso(),
          summary: await this.getSimilarityReportSummary(),
          items: await this.getSimilarityReportItems(limit),
        });
      case "audio-fraud-dashboard":
        return Object.freeze({
          name,
          generatedAt: nowIso(),
          summary: await this.getAudioFraudReportSummary(),
          items: await this.getAudioFraudReportItems(limit),
        });
      case "catalog-duplicate-dashboard":
        return Object.freeze({
          name,
          generatedAt: nowIso(),
          summary: await this.getCatalogDuplicateReportSummary(),
          items: await this.getCatalogDuplicateReportItems(limit),
        });
      case "metadata-dashboard":
        return Object.freeze({
          name,
          generatedAt: nowIso(),
          summary: await this.getMetadataValidationSummary(),
          items: await this.getMetadataValidationItems(limit),
        });
      case "dsp-compatibility-dashboard":
        return Object.freeze({
          name,
          generatedAt: nowIso(),
          summary: await this.getCompatibilitySummary(),
          items: await this.getCompatibilityItems(limit),
        });
      case "metadata-quality-dashboard":
        return Object.freeze({
          name,
          generatedAt: nowIso(),
          summary: await this.getMetadataQualitySummary(),
          items: await this.getMetadataQualityItems(limit),
        });
      case "identifier-dashboard":
        return Object.freeze({
          name,
          generatedAt: nowIso(),
          summary: await this.getIdentifierSummary(),
          items: await this.getIdentifierItems(limit),
        });
      case "release-readiness-dashboard":
        return Object.freeze({
          name,
          generatedAt: nowIso(),
          summary: await this.getReleaseReadinessSummary(),
          items: await this.getReleaseReadinessItems(limit),
        });
      case "recommendation-dashboard":
        return Object.freeze({
          name,
          generatedAt: nowIso(),
          summary: await this.getRecommendationSummary(),
          items: await this.getRecommendationItems(limit),
        });
      case "release-calendar-dashboard":
        return Object.freeze({
          name,
          generatedAt: nowIso(),
          summary: await this.getReleaseCalendarSummary(),
          items: await this.getReleaseCalendarItems(limit),
        });
      case "delivery-dashboard":
        return Object.freeze({
          name,
          generatedAt: nowIso(),
          summary: await this.getDeliverySummary(),
          items: await this.getDeliveryItems(limit),
        });
      case "workflow-dashboard":
        return Object.freeze({
          name,
          generatedAt: nowIso(),
          summary: await this.getWorkflowSummary(),
          items: await this.getWorkflowItems(limit),
        });
      case "automation-dashboard":
        return Object.freeze({
          name,
          generatedAt: nowIso(),
          summary: await this.getReleaseAutomationSummary(),
          items: await this.getReleaseAutomationItems(limit),
        });
      case "retry-dashboard":
        return Object.freeze({
          name,
          generatedAt: nowIso(),
          summary: await this.getRetrySummary(),
          items: await this.getRetryItems(limit),
        });
      case "sla-dashboard":
        return Object.freeze({
          name,
          generatedAt: nowIso(),
          summary: await this.getSlaSummary(),
          items: await this.getSlaItems(limit),
        });
      case "release-health-dashboard":
        return Object.freeze({
          name,
          generatedAt: nowIso(),
          summary: await this.getReleaseAutomationHealthSummary(),
          items: await this.getDeliveryHealthItems(limit),
        });
      case "royalty-health":
        return Object.freeze({
          name,
          generatedAt: nowIso(),
          summary: await this.getRoyaltyHealth(),
          items: await this.listRoyaltyPeriods(limit),
        });
      case "backup-dashboard":
        return this.getBackupRecoveryService().getDashboard(name, limit);
      case "recovery-dashboard":
        return this.getBackupRecoveryService().getDashboard(name, limit);
      case "storage-usage-dashboard":
        return this.getBackupRecoveryService().getDashboard(name, limit);
      case "backup-health-panel":
        return this.getBackupRecoveryService().getDashboard(name, limit);
      case "recovery-timeline":
        return this.getBackupRecoveryService().getDashboard(name, limit);
    }

    throw new Error(`Unsupported dashboard: ${name}`);
  }

  async getReport(name: EnterpriseReportName, limit = 50): Promise<EnterpriseReportResult> {
    switch (name) {
      case "rejected-releases":
        return {
          name,
          generatedAt: nowIso(),
          items: await this.getRejectedReleases(limit),
          summary: await this.getReviewSummary(),
        };
      case "duplicate-releases":
        return {
          name,
          generatedAt: nowIso(),
          items: await this.getDuplicateReleases(limit),
          summary: await this.getCatalogHealth(),
        };
      case "rights-conflicts":
        return {
          name,
          generatedAt: nowIso(),
          items: await this.getRightsConflictReport(limit),
          summary: await this.getRightsConflictSummary(),
        };
      case "delivery-failures":
        return {
          name,
          generatedAt: nowIso(),
          items: await this.getDeliveryFailures(limit),
          summary: await this.getDeliveryHealth(),
        };
      case "dsp-errors":
        return {
          name,
          generatedAt: nowIso(),
          items: await this.getDspErrors(limit),
          summary: await this.getDeliveryHealth(),
        };
      case "royalty-exceptions":
        return {
          name,
          generatedAt: nowIso(),
          items: await this.getRoyaltyExceptions(limit),
          summary: await this.getRoyaltyHealth(),
        };
      case "fraud-reports":
        return {
          name,
          generatedAt: nowIso(),
          items: await this.getFraudQueue(limit),
          summary: await this.getFraudSummary(),
        };
      case "fingerprint-reports":
        return {
          name,
          generatedAt: nowIso(),
          items: await this.getFingerprintReportItems(limit),
          summary: await this.getFingerprintReportSummary(),
        };
      case "duplicate-report":
        return {
          name,
          generatedAt: nowIso(),
          items: await this.getDuplicateReportItems(limit),
          summary: await this.getDuplicateReportSummary(),
        };
      case "similarity-report":
        return {
          name,
          generatedAt: nowIso(),
          items: await this.getSimilarityReportItems(limit),
          summary: await this.getSimilarityReportSummary(),
        };
      case "audio-fraud-report":
        return {
          name,
          generatedAt: nowIso(),
          items: await this.getAudioFraudReportItems(limit),
          summary: await this.getAudioFraudReportSummary(),
        };
      case "rights-match-report":
        return {
          name,
          generatedAt: nowIso(),
          items: await this.getRightsMatchReportItems(limit),
          summary: await this.getRightsMatchReportSummary(),
        };
      case "catalog-duplicate-report":
        return {
          name,
          generatedAt: nowIso(),
          items: await this.getCatalogDuplicateReportItems(limit),
          summary: await this.getCatalogDuplicateReportSummary(),
        };
      case "metadata-validation-report":
        return {
          name,
          generatedAt: nowIso(),
          items: await this.getMetadataValidationItems(limit),
          summary: await this.getMetadataValidationSummary(),
        };
      case "metadata-quality-report":
        return {
          name,
          generatedAt: nowIso(),
          items: await this.getMetadataQualityItems(limit),
          summary: await this.getMetadataQualitySummary(),
        };
      case "dsp-compatibility-report":
        return {
          name,
          generatedAt: nowIso(),
          items: await this.getCompatibilityItems(limit),
          summary: await this.getCompatibilitySummary(),
        };
      case "publishing-report":
        return {
          name,
          generatedAt: nowIso(),
          items: await this.getPublishingReportItems(limit),
          summary: await this.getPublishingReportSummary(),
        };
      case "rights-report":
        return {
          name,
          generatedAt: nowIso(),
          items: await this.getRightsReportItems(limit),
          summary: await this.getRightsReportSummary(),
        };
      case "release-readiness-report":
        return {
          name,
          generatedAt: nowIso(),
          items: await this.getReleaseReadinessItems(limit),
          summary: await this.getReleaseReadinessSummary(),
        };
      case "metadata-audit-report":
        return {
          name,
          generatedAt: nowIso(),
          items: await this.getMetadataAuditReportItems(limit),
          summary: await this.getMetadataAuditReportSummary(),
        };
      case "identifier-report":
        return {
          name,
          generatedAt: nowIso(),
          items: await this.getIdentifierItems(limit),
          summary: await this.getIdentifierSummary(),
        };
      case "release-calendar-report":
        return {
          name,
          generatedAt: nowIso(),
          items: await this.getReleaseCalendarItems(limit),
          summary: await this.getReleaseCalendarSummary(),
        };
      case "delivery-report":
        return {
          name,
          generatedAt: nowIso(),
          items: await this.getDeliveryItems(limit),
          summary: await this.getDeliverySummary(),
        };
      case "delivery-failure-report":
        return {
          name,
          generatedAt: nowIso(),
          items: await this.getDeliveryFailureItems(limit),
          summary: await this.getDeliveryFailureSummary(),
        };
      case "retry-report":
        return {
          name,
          generatedAt: nowIso(),
          items: await this.getRetryItems(limit),
          summary: await this.getRetrySummary(),
        };
      case "sla-report":
        return {
          name,
          generatedAt: nowIso(),
          items: await this.getSlaItems(limit),
          summary: await this.getSlaSummary(),
        };
      case "release-automation-report":
        return {
          name,
          generatedAt: nowIso(),
          items: await this.getReleaseAutomationItems(limit),
          summary: await this.getReleaseAutomationSummary(),
        };
      case "workflow-report":
        return {
          name,
          generatedAt: nowIso(),
          items: await this.getWorkflowItems(limit),
          summary: await this.getWorkflowSummary(),
        };
      case "delivery-health-report":
        return {
          name,
          generatedAt: nowIso(),
          items: await this.getDeliveryHealthItems(limit),
          summary: await this.getReleaseAutomationHealthSummary(),
        };
      case "backup-report":
        return this.getBackupRecoveryService().getReport(name, limit);
      case "restore-report":
        return this.getBackupRecoveryService().getReport(name, limit);
      case "recovery-report":
        return this.getBackupRecoveryService().getReport(name, limit);
      case "retention-report":
        return this.getBackupRecoveryService().getReport(name, limit);
      case "integrity-verification-report":
        return this.getBackupRecoveryService().getReport(name, limit);
      case "audit-reports":
        return {
          name,
          generatedAt: nowIso(),
          items: await this.getAuditReport(limit),
          summary: { limit },
        };
    }

    throw new Error(`Unsupported report: ${name}`);
  }

  async assignReviewQueueItem(input: {
    queueId: string;
    adminId: string;
    notes: string;
    audit: EnterpriseAuditContext;
  }): Promise<EnterpriseReviewQueueItem | null> {
    const before = await this.queryOne<ReviewQueueRow>("SELECT * FROM public.review_queue WHERE id = :queueId LIMIT 1", { queueId: input.queueId });
    const rows = await this.sql.query<ReviewQueueRow>(
      "SELECT * FROM public.assign_review_queue_item(:queueId, :adminId, :notes)",
      { queueId: input.queueId, adminId: input.adminId, notes: input.notes.trim() },
    );
    const after = rows[0] ?? null;
    if (after) {
      await this.recordAuditLog({
        entityType: "review_queue",
        entityId: after.id,
        releaseId: after.release_id,
        action: "REVIEW_QUEUE_ASSIGNED",
        status: after.queue_status,
        actor: input.audit.actor,
        oldValue: before,
        newValue: after,
        reason: input.audit.reason,
        ipAddress: input.audit.ipAddress,
        correlationId: input.audit.correlationId,
      });
    }
    return after ? this.toReviewQueueItem(after) : null;
  }

  async decideReviewQueueItem(input: {
    queueId: string;
    decision: "approve" | "reject" | "needs_changes" | "escalate";
    notes: string;
    audit: EnterpriseAuditContext;
  }): Promise<EnterpriseReviewQueueItem | null> {
    const before = await this.queryOne<ReviewQueueRow>("SELECT * FROM public.review_queue WHERE id = :queueId LIMIT 1", { queueId: input.queueId });
    const rows = await this.sql.query<ReviewQueueRow>(
      "SELECT * FROM public.review_release_action(:queueId, :decision, :notes)",
      { queueId: input.queueId, decision: input.decision, notes: input.notes.trim() },
    );
    const after = rows[0] ?? null;
    if (after) {
      await this.recordAuditLog({
        entityType: "review_queue",
        entityId: after.id,
        releaseId: after.release_id,
        action: `REVIEW_QUEUE_${input.decision.toUpperCase()}`,
        status: after.queue_status,
        actor: input.audit.actor,
        oldValue: before,
        newValue: after,
        reason: input.audit.reason,
        ipAddress: input.audit.ipAddress,
        correlationId: input.audit.correlationId,
      });
    }
    return after ? this.toReviewQueueItem(after) : null;
  }

  async decideFraudReview(input: {
    reviewId: string;
    decision: "APPROVE" | "REJECT" | "ESCALATE";
    notes: string;
    audit: EnterpriseAuditContext;
  }): Promise<EnterpriseFraudQueueItem | null> {
    const before = await this.queryOne<FraudReviewQueueRow>("SELECT * FROM public.fraud_review_queue WHERE review_id = :reviewId LIMIT 1", { reviewId: input.reviewId });
    const rows = await this.sql.query<Readonly<Record<string, unknown>>>(
      "SELECT * FROM public.decide_fraud_review(:reviewId, :decision, :notes)",
      { reviewId: input.reviewId, decision: input.decision, notes: input.notes.trim() },
    );
    const result = rows[0] ?? null;
    if (result) {
      await this.recordAuditLog({
        entityType: "fraud_review",
        entityId: String((result as { id?: unknown }).id ?? input.reviewId),
        releaseId: null,
        trackId: before?.track_id ?? null,
        action: `FRAUD_REVIEW_${input.decision}`,
        status: input.decision,
        actor: input.audit.actor,
        oldValue: before,
        newValue: result,
        reason: input.audit.reason,
        ipAddress: input.audit.ipAddress,
        correlationId: input.audit.correlationId,
      });
    }
    return before ? this.toFraudQueueItem(before) : null;
  }

  async getOverview(): Promise<EnterpriseOverview> {
    const [reviewSummary, fraudSummary, deliveryHealth, royaltyHealth, catalogHealth] = await Promise.all([
      this.getReviewSummary(),
      this.getFraudSummary(),
      this.getDeliveryHealth(),
      this.getRoyaltyHealth(),
      this.getCatalogHealth(),
    ]);

    return Object.freeze({
      generatedAt: nowIso(),
      pendingReviewCount: Number(reviewSummary.pending ?? 0),
      fraudQueueCount: Number(fraudSummary.pending ?? 0),
      failedDeliveryCount: Number(deliveryHealth.failed ?? 0),
      openRoyaltyPeriodCount: Number(royaltyHealth.openPeriods ?? 0),
      validationFailureCount: Number(catalogHealth.validationFailures ?? 0),
      duplicateReleaseCount: Number(catalogHealth.duplicateReleases ?? 0),
      rightConflictCount: Number(catalogHealth.rightConflicts ?? 0),
    });
  }

  async getRightsReviewQueue(limit = 50): Promise<readonly EnterpriseReviewQueueItem[]> {
    const rows = await this.sql.query<ReviewQueueRow & { title: string | null; primary_artist: string | null }>(
      `SELECT q.*, r.title, r.primary_artist
       FROM public.review_queue q
       JOIN public.releases r ON r.id = q.release_id
       ORDER BY q.validation_score ASC, q.created_at DESC
       LIMIT :limit`,
      { limit: Math.max(1, Math.trunc(limit)) },
    );
    return Object.freeze(rows.map((row) => this.toReviewQueueItem(row)));
  }

  async getContentReviewQueue(limit = 50): Promise<readonly EnterpriseReviewQueueItem[]> {
    return this.getRightsReviewQueue(limit);
  }

  async getFraudQueue(limit = 50): Promise<readonly EnterpriseFraudQueueItem[]> {
    const rows = await this.sql.query<FraudReviewQueueRow>(
      `SELECT review_id, fraud_event_id, event_id, track_id, user_id, platform, fraud_score, reasons, queued_at
       FROM public.fraud_review_queue
       ORDER BY queued_at DESC
       LIMIT :limit`,
      { limit: Math.max(1, Math.trunc(limit)) },
    );
    return Object.freeze(rows.map((row) => this.toFraudQueueItem(row)));
  }

  async getDeliveryQueue(limit = 50): Promise<readonly EnterpriseDeliveryQueueItem[]> {
    const rows = await this.sql.query<DistributionJobRow & { title: string | null; primary_artist: string | null; last_audit_action: string | null }>(
      `SELECT dj.*, r.title, r.primary_artist, (
         SELECT dal.action
         FROM public.distribution_audit_logs dal
         WHERE dal.distribution_job_id = dj.id
         ORDER BY dal.created_at DESC
         LIMIT 1
       ) AS last_audit_action
       FROM public.distribution_jobs dj
       LEFT JOIN public.releases r ON r.id = dj.release_id
       ORDER BY dj.created_at DESC
       LIMIT :limit`,
      { limit: Math.max(1, Math.trunc(limit)) },
    );
    return Object.freeze(rows.map((row) => ({
      jobId: row.id,
      releaseId: row.release_id ?? "",
      title: row.title ?? "",
      primaryArtist: row.primary_artist ?? "",
      platform: row.platform,
      status: row.status,
      attempts: Number(row.attempts ?? 0),
      nextRetryAt: row.next_retry_at,
      createdAt: row.created_at,
      lastAuditAction: row.last_audit_action ?? null,
    })));
  }

  async getRoyaltyPeriods(limit = 50): Promise<readonly EnterpriseRoyaltyPeriodItem[]> {
    const rows = await this.sql.query<RoyaltyPeriodRow>(
      `SELECT rp.id,
              rp.period_type,
              rp.period_start::text AS period_start,
              rp.period_end::text AS period_end,
              rp.status,
              rp.closed_at::text AS closed_at,
              rp.published_at::text AS published_at,
              COUNT(rs.id)::int AS statement_count,
              COALESCE(SUM(rs.payable_amount), 0)::numeric AS total_payable_amount,
              MAX(rs.currency) AS currency
       FROM public.royalty_periods rp
       LEFT JOIN public.royalty_statements rs ON rs.period_id = rp.id
       GROUP BY rp.id
       ORDER BY rp.period_start DESC
       LIMIT :limit`,
      { limit: Math.max(1, Math.trunc(limit)) },
    );
    return Object.freeze(rows.map((row) => ({
      periodId: row.id,
      periodType: row.period_type,
      periodStart: row.period_start,
      periodEnd: row.period_end,
      status: row.status,
      closedAt: row.closed_at,
      publishedAt: row.published_at,
      statementCount: Number(row.statement_count ?? 0),
      totalPayableAmount: Number(row.total_payable_amount ?? 0),
      currency: row.currency,
    })));
  }

  async getAuditTrail(releaseId: string, limit = 100): Promise<readonly EnterpriseAuditTrailEntry[]> {
    const rows = await this.sql.query<AuditTrailRow>(
      `SELECT source, entity_id, action, status, actor, created_at, metadata
       FROM (
         SELECT 'distribution_audit_logs' AS source,
                dal.release_id::text AS entity_id,
                dal.action,
                dal.status,
                dal.actor,
                dal.created_at::text AS created_at,
                dal.metadata
         FROM public.distribution_audit_logs dal
         WHERE dal.release_id = :releaseId
         UNION ALL
         SELECT 'review_audit_log' AS source,
                ral.release_id::text AS entity_id,
                ral.action,
                ral.action::text AS status,
                COALESCE(ral.admin_id::text, 'system') AS actor,
                ral.created_at::text AS created_at,
                jsonb_build_object('notes', ral.notes, 'review_queue_id', ral.review_queue_id) AS metadata
         FROM public.review_audit_log ral
         WHERE ral.release_id = :releaseId
         UNION ALL
         SELECT 'fraud_audit_logs' AS source,
                fal.fraud_event_id::text AS entity_id,
                fal.action,
                fal.action::text AS status,
                COALESCE(fal.actor_admin_id::text, 'system') AS actor,
                fal.created_at::text AS created_at,
                fal.metadata
         FROM public.fraud_audit_logs fal
         WHERE fal.fraud_event_id IN (
           SELECT fr.fraud_event_id
           FROM public.fraud_reviews fr
           JOIN public.fraud_events fe ON fe.id = fr.fraud_event_id
           WHERE fe.release_id = :releaseId OR fe.track_id IN (SELECT t.id FROM public.tracks t WHERE t.release_id = :releaseId)
         )
       ) audit_entries
       ORDER BY created_at DESC
       LIMIT :limit`,
      { releaseId, limit: Math.max(1, Math.trunc(limit)) },
    );
    return Object.freeze(rows.map((row) => ({
      source: row.source,
      entityId: row.entity_id,
      action: row.action,
      status: row.status,
      actor: row.actor,
      createdAt: row.created_at,
      metadata: normalizeRecord(row.metadata),
    })));
  }

  async getIdentifierReportByRelease(releaseId: string): Promise<EnterpriseIdentifierReport | null> {
    const bundle = await this.distributionStore.getReleaseWithTracks(releaseId);
    if (!bundle) return null;
    const [upcMatches, tracks, duplicateIsrcMatches] = await this.getIdentifierReport(bundle.release, bundle.tracks);
    return Object.freeze({
      releaseId,
      upc: bundle.release.upc ?? null,
      upcMatches,
      tracks,
      duplicateIsrcMatches,
      generatedUpc: bundle.release.upc ?? await this.identifierGenerator.generateUPC(),
      generatedIsrcs: Object.freeze(bundle.tracks.map((track) => this.generateIsrc(track, bundle.release))),
    });
  }

  async getReportByName(name: EnterpriseReportName, limit = 50): Promise<EnterpriseReportResult> {
    return this.getReport(name, limit);
  }

  private getBackupRecoveryService(): BackupDisasterRecoveryService {
    return new BackupDisasterRecoveryService({
      sql: this.sql,
      distributionService: this,
    });
  }

  private async getValidationRows(releaseId: string): Promise<readonly EnterpriseValidationEntry[]> {
    const rows = await this.sql.query<ValidationRow>(
      `SELECT validation_type, status, details, created_at::text AS created_at
       FROM (
         SELECT DISTINCT ON (validation_type) validation_type, status, details, created_at, id
         FROM public.media_validation_results
         WHERE release_id = :releaseId
         ORDER BY validation_type, created_at DESC, id DESC
       ) latest
       ORDER BY validation_type`,
      { releaseId },
    );
    return Object.freeze(rows.map((row) => ({
      validationType: row.validation_type,
      status: row.status,
      details: normalizeRecord(row.details),
      createdAt: row.created_at,
    })));
  }

  private async getDuplicateRows(releaseId: string): Promise<readonly EnterpriseDuplicateEntry[]> {
    const rows = await this.sql.query<DuplicateRow>(
      `SELECT id, duplicate_type, severity, details, created_at::text AS created_at
       FROM public.release_duplicates
       WHERE release_id = :releaseId
       ORDER BY created_at DESC`,
      { releaseId },
    );
    return Object.freeze(rows.map((row) => ({
      id: row.id,
      duplicateType: row.duplicate_type,
      severity: row.severity,
      details: normalizeRecord(row.details),
      createdAt: row.created_at,
    })));
  }

  private async getCopyrightFlags(releaseId: string): Promise<readonly EnterpriseCopyrightFlagEntry[]> {
    const rows = await this.sql.query<CopyrightFlagRow>(
      `SELECT id, suspicious_title, suspicious_artist, suspicious_metadata, reason, details, created_at::text AS created_at
       FROM public.copyright_flags
       WHERE release_id = :releaseId
       ORDER BY created_at DESC`,
      { releaseId },
    );
    return Object.freeze(rows.map((row) => ({
      id: row.id,
      suspiciousTitle: row.suspicious_title,
      suspiciousArtist: row.suspicious_artist,
      suspiciousMetadata: row.suspicious_metadata,
      reason: row.reason,
      details: normalizeRecord(row.details),
      createdAt: row.created_at,
    })));
  }

  private async getReviewQueueRow(releaseId: string): Promise<EnterpriseReviewQueueItem | null> {
    const row = await this.queryOne<ReviewQueueRow>(
      `SELECT q.*, r.title, r.primary_artist
       FROM public.review_queue q
       JOIN public.releases r ON r.id = q.release_id
       WHERE q.release_id = :releaseId
       LIMIT 1`,
      { releaseId },
    );
    return row ? this.toReviewQueueItem(row) : null;
  }

  private async getIdentifierReport(release: DistributionRelease, tracks: readonly DistributionTrack[]): Promise<[
    readonly IdentifierMatch[],
    readonly TrackIdentifierReport[],
    readonly IdentifierMatch[],
  ]> {
    const upcMatches = release.upc
      ? await this.sql.query<ReleaseDuplicateMatchRow>(
          `SELECT id, title
           FROM public.releases
           WHERE upc = :upc
             AND id <> :releaseId
           ORDER BY created_at DESC
           LIMIT 20`,
          { upc: release.upc, releaseId: release.id },
        )
      : [];

    const trackReports = await Promise.all(tracks.map(async (track) => {
      const isrc = normalizeMaybeString(track.isrc);
      const duplicateMatches = isrc
        ? await this.sql.query<TrackDuplicateMatchRow>(
            `SELECT id, title
             FROM public.tracks
             WHERE isrc = :isrc
               AND id <> :trackId
             UNION ALL
             SELECT id, title
             FROM public.songs
             WHERE isrc = :isrc
               AND id <> :trackId
             LIMIT 20`,
            { isrc, trackId: track.id },
          )
        : [];

      return {
        trackId: track.id,
        title: track.title ?? "",
        isrc: isrc,
        generatedIsrc: this.generateIsrc(track, release),
        duplicateMatches: duplicateMatches.map((match) => ({
          id: match.id,
          title: match.title,
          source: "catalog",
        })),
      } satisfies TrackIdentifierReport;
    }));

    const duplicateIsrcMatches = Object.freeze(trackReports.flatMap((track) => track.duplicateMatches));
    return [
      Object.freeze(upcMatches.map((match) => ({
        id: match.id,
        title: match.title,
        source: "release",
      }))),
      Object.freeze(trackReports),
      duplicateIsrcMatches,
    ];
  }

  private generateIsrc(track: DistributionTrack, release: DistributionRelease): string {
    const country = "US";
    const registrant = "TSY";
    const year = String(new Date().getUTCFullYear()).slice(-2);
    const base = `${release.id}:${track.id}:${track.title ?? ""}`;
    const hash = Array.from(base).reduce((sum, character) => sum + character.charCodeAt(0), 0).toString().padStart(5, "0").slice(0, 5);
    return `${country}${registrant}${year}${hash}`;
  }

  private collectRightsIssues(
    release: DistributionRelease,
    tracks: readonly DistributionTrack[],
    validation: readonly EnterpriseValidationEntry[],
    duplicates: readonly EnterpriseDuplicateEntry[],
    copyrightFlags: readonly EnterpriseCopyrightFlagEntry[],
    moderationFlags: readonly string[],
  ): readonly string[] {
    const issues: string[] = [];
    if (!release.rightsOwned) issues.push("Release rights are not confirmed.");
    if (!normalizeMaybeString(release.copyrightOwner)) issues.push("Copyright owner is missing.");
    if (!tracks.length) issues.push("Release has no tracks.");
    if (validation.some((entry) => entry.validationType === "copyright" && entry.status === "failed")) issues.push("Copyright validation failed.");
    if (duplicates.some((entry) => entry.severity === "blocker")) issues.push("Blocking duplicates were detected.");
    if (copyrightFlags.length) issues.push("Copyright flags require review.");
    if (moderationFlags.length) issues.push("Moderation flags require review.");
    return Object.freeze(issues);
  }

  private collectIdentifierIssues(
    release: DistributionRelease,
    tracks: readonly DistributionTrack[],
    upcMatches: readonly IdentifierMatch[],
    trackReports: readonly TrackIdentifierReport[],
    duplicateIsrcMatches: readonly IdentifierMatch[],
  ): readonly string[] {
    const issues: string[] = [];
    if (!normalizeMaybeString(release.upc)) issues.push("UPC is missing.");
    if (upcMatches.length) issues.push("Duplicate UPC detected.");
    for (const track of tracks) {
      if (!normalizeMaybeString(track.isrc) && !track.generateIsrc) {
        issues.push(`Track ${track.id} is missing an ISRC.`);
      }
    }
    if (duplicateIsrcMatches.length) issues.push("Duplicate ISRC detected.");
    if (!trackReports.length) issues.push("Track identifier report is empty.");
    return Object.freeze(issues);
  }

  private isOwnershipVerified(
    release: DistributionRelease,
    tracks: readonly DistributionTrack[],
    rightsIssues: readonly string[],
    validation: readonly EnterpriseValidationEntry[],
  ): boolean {
    const requiredTracks = tracks.every((track) => normalizeMaybeString(track.composer) || normalizeMaybeString(track.author) || normalizeMaybeString(track.publisher));
    return Boolean(release.rightsOwned) && Boolean(release.copyrightOwner) && requiredTracks && rightsIssues.length === 0 && validation.every((entry) => entry.validationType !== "copyright" || entry.status !== "failed");
  }

  private resolveStage(
    releaseStatus: string | null | undefined,
    reviewQueue: EnterpriseReviewQueueItem | null,
    validation: readonly EnterpriseValidationEntry[],
    duplicates: readonly EnterpriseDuplicateEntry[],
    copyrightFlags: readonly EnterpriseCopyrightFlagEntry[],
    moderationFlags: readonly string[],
  ): EnterpriseReviewStage {
    const directStage = stageFromStatus(releaseStatus);
    if (directStage !== "Pending Review") return directStage;
    if (reviewQueue?.queueStatus) {
      const queueStage = queueStatusToStage(reviewQueue.queueStatus);
      if (queueStage !== "Pending Review") return queueStage;
    }
    if (validation.some((entry) => entry.validationType === "metadata" && entry.status === "failed")) return "Metadata Review";
    if (validation.some((entry) => entry.validationType === "audio" && entry.status === "failed")) return "Audio Review";
    if (validation.some((entry) => entry.validationType === "artwork" && entry.status === "failed")) return "Artwork Review";
    if (validation.some((entry) => entry.validationType === "copyright" && entry.status === "failed") || copyrightFlags.length) return "Copyright Review";
    if (duplicates.some((entry) => entry.severity === "blocker") || moderationFlags.length) return "Fraud Review";
    return "Pending Review";
  }

  private calculateReadinessScore(
    validation: readonly EnterpriseValidationEntry[],
    duplicates: readonly EnterpriseDuplicateEntry[],
    copyrightFlags: readonly EnterpriseCopyrightFlagEntry[],
    moderationFlags: readonly string[],
    reviewQueue: EnterpriseReviewQueueItem | null,
  ): number {
    let score = validationSeverityScore(validation);
    score -= duplicates.filter((entry) => entry.severity === "blocker").length * 15;
    score -= copyrightFlags.length * 10;
    score -= moderationFlags.length * 5;
    if (reviewQueue?.queueStatus === "needs_changes") score -= 10;
    if (reviewQueue?.queueStatus === "rejected") score -= 20;
    return Math.max(0, Math.min(100, score));
  }

  private toReviewQueueItem(row: ReviewQueueRow): EnterpriseReviewQueueItem {
    return Object.freeze({
      queueId: row.id,
      releaseId: row.release_id,
      title: normalizeMaybeString(row.title) ?? "",
      primaryArtist: normalizeMaybeString(row.primary_artist) ?? "",
      queueStatus: row.queue_status,
      validationScore: Number(row.validation_score ?? 0),
      priority: Number(row.priority ?? 0),
      assignedAdmin: row.assigned_admin,
      changeRequestNotes: row.change_request_notes,
      escalationReason: row.escalation_reason,
      firstReviewedAt: row.first_reviewed_at,
      reviewedAt: row.reviewed_at,
      approvedAt: row.approved_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      stage: queueStatusToStage(row.queue_status),
    });
  }

  private toFraudQueueItem(row: FraudReviewQueueRow): EnterpriseFraudQueueItem {
    const reasons = normalizeStringArray(row.reasons);
    return Object.freeze({
      reviewId: row.review_id,
      fraudEventId: row.fraud_event_id,
      eventId: row.event_id,
      trackId: row.track_id,
      userId: row.user_id,
      platform: row.platform,
      fraudScore: Number(row.fraud_score ?? 0),
      reasons,
      queuedAt: row.queued_at,
      riskScore: Math.max(0, Math.min(100, Number(row.fraud_score ?? 0) + Math.min(20, reasons.length * 4))),
    });
  }

  private async getReviewSummary(): Promise<Readonly<Record<string, unknown>>> {
    const rows = await this.sql.query<Readonly<{ pending_count: number; avg_review_time_hours: number | null; approvals_today: number; rejection_rate: number | null }>>("SELECT * FROM public.review_queue_metrics()");
    const row = rows[0] ?? { pending_count: 0, avg_review_time_hours: null, approvals_today: 0, rejection_rate: null };
    return Object.freeze({
      pending: Number(row.pending_count ?? 0),
      averageReviewTimeHours: row.avg_review_time_hours ?? null,
      approvalsToday: Number(row.approvals_today ?? 0),
      rejectionRate: row.rejection_rate ?? null,
    });
  }

  private async getFraudSummary(): Promise<Readonly<Record<string, unknown>>> {
    const [queueRows, analyticsRows] = await Promise.all([
      this.sql.query<{ pending_count: number }>(
        "SELECT COUNT(*)::int AS pending_count FROM public.fraud_review_queue",
      ),
      this.sql.query<{ calculated_at: string; summary: unknown }>(
        "SELECT calculated_at::text AS calculated_at, summary FROM public.fraud_analytics_snapshots ORDER BY calculated_at DESC LIMIT 1",
      ),
    ]);
    return Object.freeze({
      pending: Number(queueRows[0]?.pending_count ?? 0),
      latestSnapshotAt: analyticsRows[0]?.calculated_at ?? null,
      latestSnapshot: analyticsRows[0]?.summary ? normalizeRecord(analyticsRows[0]?.summary) : null,
    });
  }

  private async getDeliveryHealth(): Promise<Readonly<Record<string, unknown>>> {
    const rows = await this.sql.query<{ failed_count: number; published_count: number; total_count: number }>(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'FAILED')::int AS failed_count,
         COUNT(*) FILTER (WHERE status = 'PUBLISHED')::int AS published_count,
         COUNT(*)::int AS total_count
       FROM public.distribution_jobs`,
    );
    const row = rows[0] ?? { failed_count: 0, published_count: 0, total_count: 0 };
    return Object.freeze({
      failed: Number(row.failed_count ?? 0),
      published: Number(row.published_count ?? 0),
      total: Number(row.total_count ?? 0),
    });
  }

  private async getReleaseAutomationHealthSummary(): Promise<Readonly<Record<string, unknown>>> {
    const rows = await this.sql.query<{ total_count: number; healthy_count: number; failed_count: number }>(
      `SELECT
         COUNT(*)::int AS total_count,
         COUNT(*) FILTER (WHERE status IN ('healthy', 'confirmed', 'met'))::int AS healthy_count,
         COUNT(*) FILTER (WHERE status IN ('failed', 'error', 'rejected'))::int AS failed_count
       FROM public.delivery_health`,
    );
    const row = rows[0] ?? { total_count: 0, healthy_count: 0, failed_count: 0 };
    return Object.freeze({
      total: Number(row.total_count ?? 0),
      healthy: Number(row.healthy_count ?? 0),
      failed: Number(row.failed_count ?? 0),
    });
  }

  private async getReleaseCalendarSummary(): Promise<Readonly<Record<string, unknown>>> {
    const rows = await this.sql.query<{ total_count: number; locked_count: number; scheduled_count: number }>(
      `SELECT
         COUNT(*)::int AS total_count,
         COUNT(*) FILTER (WHERE state = 'locked')::int AS locked_count,
         COUNT(*) FILTER (WHERE state = 'scheduled')::int AS scheduled_count
       FROM public.release_calendar`,
    );
    const row = rows[0] ?? { total_count: 0, locked_count: 0, scheduled_count: 0 };
    return Object.freeze({
      total: Number(row.total_count ?? 0),
      locked: Number(row.locked_count ?? 0),
      scheduled: Number(row.scheduled_count ?? 0),
    });
  }

  private async getReleaseCalendarItems(limit = 50): Promise<readonly unknown[]> {
    const rows = await this.sql.query<Readonly<Record<string, unknown>>>(
      `SELECT calendar_id, release_id, track_id, scheduled_for::text AS scheduled_for, timezone, embargo_until::text AS embargo_until, state, metadata, created_at::text AS created_at
       FROM public.release_calendar
       ORDER BY scheduled_for ASC
       LIMIT :limit`,
      { limit: Math.max(1, Math.trunc(limit)) },
    );
    return Object.freeze(rows.map((row) => ({
      calendarId: row.calendar_id ?? null,
      releaseId: row.release_id ?? null,
      trackId: row.track_id ?? null,
      scheduledFor: row.scheduled_for ?? null,
      timezone: row.timezone ?? null,
      embargoUntil: row.embargo_until ?? null,
      state: row.state ?? null,
      metadata: normalizeRecord(row.metadata),
      createdAt: row.created_at ?? null,
    })));
  }

  private async getDeliverySummary(): Promise<Readonly<Record<string, unknown>>> {
    const rows = await this.sql.query<{ total_count: number; ready_count: number; active_count: number }>(
      `SELECT
         COUNT(*)::int AS total_count,
         COUNT(*) FILTER (WHERE status = 'ready')::int AS ready_count,
         COUNT(*) FILTER (WHERE status = 'running')::int AS active_count
       FROM public.delivery_batches`,
    );
    const row = rows[0] ?? { total_count: 0, ready_count: 0, active_count: 0 };
    return Object.freeze({
      total: Number(row.total_count ?? 0),
      ready: Number(row.ready_count ?? 0),
      active: Number(row.active_count ?? 0),
    });
  }

  private async getDeliveryItems(limit = 50): Promise<readonly unknown[]> {
    const rows = await this.sql.query<Readonly<Record<string, unknown>>>(
      `SELECT batch_id, release_id, track_id, target_count, priority, readiness_score, metadata, created_at::text AS created_at, updated_at::text AS updated_at
       FROM public.delivery_batches
       ORDER BY created_at DESC
       LIMIT :limit`,
      { limit: Math.max(1, Math.trunc(limit)) },
    );
    return Object.freeze(rows.map((row) => ({
      batchId: row.batch_id ?? null,
      releaseId: row.release_id ?? null,
      trackId: row.track_id ?? null,
      targetCount: row.target_count ?? null,
      priority: row.priority ?? null,
      readinessScore: row.readiness_score ?? null,
      metadata: normalizeRecord(row.metadata),
      createdAt: row.created_at ?? null,
      updatedAt: row.updated_at ?? null,
    })));
  }

  private async getDeliveryFailureSummary(): Promise<Readonly<Record<string, unknown>>> {
    const rows = await this.sql.query<{ failed_count: number; retry_count: number }>(
      `SELECT
         COUNT(*) FILTER (WHERE status IN ('FAILED', 'REJECTED'))::int AS failed_count,
         COUNT(*) FILTER (WHERE attempt_number > 1)::int AS retry_count
       FROM public.delivery_attempts`,
    );
    const row = rows[0] ?? { failed_count: 0, retry_count: 0 };
    return Object.freeze({
      failed: Number(row.failed_count ?? 0),
      retried: Number(row.retry_count ?? 0),
    });
  }

  private async getDeliveryFailureItems(limit = 50): Promise<readonly unknown[]> {
    const rows = await this.sql.query<Readonly<Record<string, unknown>>>(
      `SELECT attempt_id, batch_id, release_id, track_id, target, attempt_number, status, last_error, metadata, created_at::text AS created_at
       FROM public.delivery_attempts
       WHERE status IN ('FAILED', 'REJECTED')
       ORDER BY created_at DESC
       LIMIT :limit`,
      { limit: Math.max(1, Math.trunc(limit)) },
    );
    return Object.freeze(rows.map((row) => ({
      attemptId: row.attempt_id ?? null,
      batchId: row.batch_id ?? null,
      releaseId: row.release_id ?? null,
      trackId: row.track_id ?? null,
      target: row.target ?? null,
      attemptNumber: row.attempt_number ?? null,
      status: row.status ?? null,
      lastError: row.last_error ?? null,
      metadata: normalizeRecord(row.metadata),
      createdAt: row.created_at ?? null,
    })));
  }

  private async getRetrySummary(): Promise<Readonly<Record<string, unknown>>> {
    const rows = await this.sql.query<{ scheduled_count: number; due_count: number }>(
      `SELECT
         COUNT(*) FILTER (WHERE attempt_number > 1)::int AS scheduled_count,
         COUNT(*) FILTER (WHERE next_retry_at IS NOT NULL AND next_retry_at <= now())::int AS due_count
       FROM public.delivery_attempts`,
    );
    const row = rows[0] ?? { scheduled_count: 0, due_count: 0 };
    return Object.freeze({
      scheduled: Number(row.scheduled_count ?? 0),
      due: Number(row.due_count ?? 0),
    });
  }

  private async getRetryItems(limit = 50): Promise<readonly unknown[]> {
    const rows = await this.sql.query<Readonly<Record<string, unknown>>>(
      `SELECT attempt_id, batch_id, release_id, track_id, target, attempt_number, next_retry_at::text AS next_retry_at, status, last_error, metadata, created_at::text AS created_at
       FROM public.delivery_attempts
       WHERE attempt_number > 1 OR next_retry_at IS NOT NULL
       ORDER BY created_at DESC
       LIMIT :limit`,
      { limit: Math.max(1, Math.trunc(limit)) },
    );
    return Object.freeze(rows.map((row) => ({
      attemptId: row.attempt_id ?? null,
      batchId: row.batch_id ?? null,
      releaseId: row.release_id ?? null,
      trackId: row.track_id ?? null,
      target: row.target ?? null,
      attemptNumber: row.attempt_number ?? null,
      nextRetryAt: row.next_retry_at ?? null,
      status: row.status ?? null,
      lastError: row.last_error ?? null,
      metadata: normalizeRecord(row.metadata),
      createdAt: row.created_at ?? null,
    })));
  }

  private async getSlaSummary(): Promise<Readonly<Record<string, unknown>>> {
    const rows = await this.sql.query<{ total_count: number; met_count: number }>(
      `SELECT
         COUNT(*)::int AS total_count,
         COUNT(*) FILTER (WHERE status = 'met')::int AS met_count
       FROM public.delivery_sla`,
    );
    const row = rows[0] ?? { total_count: 0, met_count: 0 };
    return Object.freeze({
      total: Number(row.total_count ?? 0),
      met: Number(row.met_count ?? 0),
    });
  }

  private async getSlaItems(limit = 50): Promise<readonly unknown[]> {
    const rows = await this.sql.query<Readonly<Record<string, unknown>>>(
      `SELECT sla_id, release_id, track_id, sla_kind, score, status, metadata, created_at::text AS created_at, updated_at::text AS updated_at
       FROM public.delivery_sla
       ORDER BY created_at DESC
       LIMIT :limit`,
      { limit: Math.max(1, Math.trunc(limit)) },
    );
    return Object.freeze(rows.map((row) => ({
      slaId: row.sla_id ?? null,
      releaseId: row.release_id ?? null,
      trackId: row.track_id ?? null,
      slaKind: row.sla_kind ?? null,
      score: row.score ?? null,
      status: row.status ?? null,
      metadata: normalizeRecord(row.metadata),
      createdAt: row.created_at ?? null,
      updatedAt: row.updated_at ?? null,
    })));
  }

  private async getReleaseAutomationSummary(): Promise<Readonly<Record<string, unknown>>> {
    const rows = await this.sql.query<{ total_count: number; active_count: number; delivered_count: number }>(
      `SELECT
         COUNT(*)::int AS total_count,
         COUNT(*) FILTER (WHERE state IN ('scheduled', 'locked', 'running', 'approved'))::int AS active_count,
         COUNT(*) FILTER (WHERE state = 'delivered')::int AS delivered_count
       FROM public.release_workflows`,
    );
    const row = rows[0] ?? { total_count: 0, active_count: 0, delivered_count: 0 };
    return Object.freeze({
      total: Number(row.total_count ?? 0),
      active: Number(row.active_count ?? 0),
      delivered: Number(row.delivered_count ?? 0),
    });
  }

  private async getReleaseAutomationItems(limit = 50): Promise<readonly unknown[]> {
    const rows = await this.sql.query<Readonly<Record<string, unknown>>>(
      `SELECT workflow_id, release_id, track_id, state, priority, scheduled_for::text AS scheduled_for, embargo_until::text AS embargo_until, batch_id, metadata, created_at::text AS created_at, updated_at::text AS updated_at
       FROM public.release_workflows
       ORDER BY updated_at DESC
       LIMIT :limit`,
      { limit: Math.max(1, Math.trunc(limit)) },
    );
    return Object.freeze(rows.map((row) => ({
      workflowId: row.workflow_id ?? null,
      releaseId: row.release_id ?? null,
      trackId: row.track_id ?? null,
      state: row.state ?? null,
      priority: row.priority ?? null,
      scheduledFor: row.scheduled_for ?? null,
      embargoUntil: row.embargo_until ?? null,
      batchId: row.batch_id ?? null,
      metadata: normalizeRecord(row.metadata),
      createdAt: row.created_at ?? null,
      updatedAt: row.updated_at ?? null,
    })));
  }

  private async getWorkflowSummary(): Promise<Readonly<Record<string, unknown>>> {
    return this.getReleaseAutomationSummary();
  }

  private async getWorkflowItems(limit = 50): Promise<readonly unknown[]> {
    return this.getReleaseAutomationItems(limit);
  }

  private async getDeliveryHealthItems(limit = 50): Promise<readonly unknown[]> {
    const rows = await this.sql.query<Readonly<Record<string, unknown>>>(
      `SELECT health_id, release_id, track_id, state, status, score, metadata, created_at::text AS created_at, updated_at::text AS updated_at
       FROM public.delivery_health
       ORDER BY created_at DESC
       LIMIT :limit`,
      { limit: Math.max(1, Math.trunc(limit)) },
    );
    return Object.freeze(rows.map((row) => ({
      healthId: row.health_id ?? null,
      releaseId: row.release_id ?? null,
      trackId: row.track_id ?? null,
      state: row.state ?? null,
      status: row.status ?? null,
      score: row.score ?? null,
      metadata: normalizeRecord(row.metadata),
      createdAt: row.created_at ?? null,
      updatedAt: row.updated_at ?? null,
    })));
  }

  private async getCatalogHealth(): Promise<Readonly<Record<string, unknown>>> {
    const rows = await this.sql.query<{ validation_failures: number; duplicate_releases: number; right_conflicts: number }>(
      `SELECT
         (SELECT COUNT(*)::int FROM public.media_validation_results WHERE status = 'failed') AS validation_failures,
         (SELECT COUNT(DISTINCT release_id)::int FROM public.release_duplicates) AS duplicate_releases,
         (SELECT COUNT(*)::int FROM public.release_duplicates WHERE duplicate_type IN ('isrc', 'audio_hash', 'artwork_hash', 'title_artist') AND severity = 'blocker') AS right_conflicts`,
    );
    const row = rows[0] ?? { validation_failures: 0, duplicate_releases: 0, right_conflicts: 0 };
    return Object.freeze({
      validationFailures: Number(row.validation_failures ?? 0),
      duplicateReleases: Number(row.duplicate_releases ?? 0),
      rightConflicts: Number(row.right_conflicts ?? 0),
    });
  }

  private async getCatalogHealthItems(limit = 50): Promise<readonly unknown[]> {
    const rows = await this.sql.query<ValidationRow & { release_id: string; title: string | null; primary_artist: string | null }>(
      `SELECT mvr.validation_type, mvr.status, mvr.details, mvr.created_at::text AS created_at, r.id AS release_id, r.title, r.primary_artist
       FROM public.media_validation_results mvr
       JOIN public.releases r ON r.id = mvr.release_id
       ORDER BY mvr.created_at DESC
       LIMIT :limit`,
      { limit: Math.max(1, Math.trunc(limit)) },
    );
    return Object.freeze(rows.map((row) => ({
      releaseId: row.release_id,
      title: row.title ?? "",
      primaryArtist: row.primary_artist ?? "",
      validationType: row.validation_type,
      status: row.status,
      details: normalizeRecord(row.details),
      createdAt: row.created_at,
    })));
  }

  private async getMetadataErrorSummary(): Promise<Readonly<Record<string, unknown>>> {
    const rows = await this.sql.query<{ failed_metadata_count: number; warning_metadata_count: number }>(
      `SELECT
         COUNT(*) FILTER (WHERE validation_type = 'metadata' AND status = 'failed')::int AS failed_metadata_count,
         COUNT(*) FILTER (WHERE validation_type = 'metadata' AND status = 'warning')::int AS warning_metadata_count
       FROM public.media_validation_results`,
    );
    const row = rows[0] ?? { failed_metadata_count: 0, warning_metadata_count: 0 };
    return Object.freeze({
      failedMetadata: Number(row.failed_metadata_count ?? 0),
      warningMetadata: Number(row.warning_metadata_count ?? 0),
    });
  }

  private async getMetadataErrorItems(limit = 50): Promise<readonly unknown[]> {
    const rows = await this.sql.query<ValidationRow & { release_id: string; title: string | null }>(
      `SELECT mvr.validation_type, mvr.status, mvr.details, mvr.created_at::text AS created_at, r.id AS release_id, r.title
       FROM public.media_validation_results mvr
       JOIN public.releases r ON r.id = mvr.release_id
       WHERE mvr.validation_type = 'metadata' AND mvr.status IN ('failed', 'warning')
       ORDER BY mvr.created_at DESC
       LIMIT :limit`,
      { limit: Math.max(1, Math.trunc(limit)) },
    );
    return Object.freeze(rows.map((row) => ({
      releaseId: row.release_id,
      title: row.title ?? "",
      status: row.status,
      details: normalizeRecord(row.details),
      createdAt: row.created_at,
    })));
  }

  private async getMetadataValidationSummary(): Promise<Readonly<Record<string, unknown>>> {
    const rows = await this.sql.query<{ total_count: number; failed_count: number; updated_count: number; latest_at: string | null }>(
      `SELECT
         COUNT(*)::int AS total_count,
         COUNT(*) FILTER (WHERE action IN ('validate', 'normalize', 'repair'))::int AS updated_count,
         COUNT(*) FILTER (WHERE status IN ('FAILED', 'REJECTED'))::int AS failed_count,
         MAX(created_at)::text AS latest_at
       FROM public.metadata_audit`,
    );
    const row = rows[0] ?? { total_count: 0, failed_count: 0, updated_count: 0, latest_at: null };
    return Object.freeze({
      total: Number(row.total_count ?? 0),
      failed: Number(row.failed_count ?? 0),
      updated: Number(row.updated_count ?? 0),
      latestAt: row.latest_at ?? null,
    });
  }

  private async getMetadataValidationItems(limit = 50): Promise<readonly unknown[]> {
    const rows = await this.sql.query<Readonly<Record<string, unknown>>>(
      `SELECT ma.audit_id, ma.release_id, ma.track_id, ma.action, ma.status, ma.actor, ma.correlation_id, ma.validation_valid, ma.created_at::text AS created_at, ma.metadata, r.title, r.primary_artist
       FROM public.metadata_audit ma
       LEFT JOIN public.releases r ON r.id = ma.release_id
       ORDER BY ma.created_at DESC
       LIMIT :limit`,
      { limit: Math.max(1, Math.trunc(limit)) },
    );
    return Object.freeze(rows.map((row) => ({
      auditId: row.audit_id ?? null,
      releaseId: row.release_id ?? null,
      trackId: row.track_id ?? null,
      title: row.title ?? null,
      primaryArtist: row.primary_artist ?? null,
      action: row.action ?? null,
      status: row.status ?? null,
      actor: row.actor ?? null,
      validationValid: row.validation_valid ?? null,
      correlationId: row.correlation_id ?? null,
      createdAt: row.created_at ?? null,
      metadata: normalizeRecord(row.metadata),
    })));
  }

  private async getMetadataQualitySummary(): Promise<Readonly<Record<string, unknown>>> {
    const rows = await this.sql.query<{ average_score: number | null; highest_score: number | null; lowest_score: number | null; count: number }>(
      `SELECT
         AVG(overall_release_score)::numeric AS average_score,
         MAX(overall_release_score)::numeric AS highest_score,
         MIN(overall_release_score)::numeric AS lowest_score,
         COUNT(*)::int AS count
       FROM public.metadata_quality`,
    );
    const row = rows[0] ?? { average_score: null, highest_score: null, lowest_score: null, count: 0 };
    return Object.freeze({
      averageScore: row.average_score ?? null,
      highestScore: row.highest_score ?? null,
      lowestScore: row.lowest_score ?? null,
      count: Number(row.count ?? 0),
    });
  }

  private async getMetadataQualityItems(limit = 50): Promise<readonly unknown[]> {
    const rows = await this.sql.query<Readonly<Record<string, unknown>>>(
      `SELECT mq.quality_id, mq.release_id, mq.track_id, mq.metadata_quality_score, mq.metadata_confidence_score, mq.metadata_completeness_score, mq.dsp_compatibility_score, mq.publishing_score, mq.rights_score, mq.delivery_score, mq.artwork_score, mq.overall_release_score, mq.created_at::text AS created_at, r.title, r.primary_artist
       FROM public.metadata_quality mq
       LEFT JOIN public.releases r ON r.id = mq.release_id
       ORDER BY mq.created_at DESC
       LIMIT :limit`,
      { limit: Math.max(1, Math.trunc(limit)) },
    );
    return Object.freeze(rows.map((row) => ({
      qualityId: row.quality_id ?? null,
      releaseId: row.release_id ?? null,
      trackId: row.track_id ?? null,
      title: row.title ?? null,
      primaryArtist: row.primary_artist ?? null,
      metadataQualityScore: row.metadata_quality_score ?? null,
      metadataConfidenceScore: row.metadata_confidence_score ?? null,
      metadataCompletenessScore: row.metadata_completeness_score ?? null,
      dspCompatibilityScore: row.dsp_compatibility_score ?? null,
      publishingScore: row.publishing_score ?? null,
      rightsScore: row.rights_score ?? null,
      deliveryScore: row.delivery_score ?? null,
      artworkScore: row.artwork_score ?? null,
      overallReleaseScore: row.overall_release_score ?? null,
      createdAt: row.created_at ?? null,
    })));
  }

  private async getCompatibilitySummary(): Promise<Readonly<Record<string, unknown>>> {
    const rows = await this.sql.query<{ average_score: number | null; compatible_count: number; incompatible_count: number }>(
      `SELECT
         AVG(dsp_compatibility_score)::numeric AS average_score,
         COUNT(*) FILTER (WHERE overall_release_score >= 70)::int AS compatible_count,
         COUNT(*) FILTER (WHERE overall_release_score < 70)::int AS incompatible_count
       FROM public.metadata_quality`,
    );
    const row = rows[0] ?? { average_score: null, compatible_count: 0, incompatible_count: 0 };
    return Object.freeze({
      averageScore: row.average_score ?? null,
      compatible: Number(row.compatible_count ?? 0),
      incompatible: Number(row.incompatible_count ?? 0),
    });
  }

  private async getCompatibilityItems(limit = 50): Promise<readonly unknown[]> {
    const rows = await this.sql.query<Readonly<Record<string, unknown>>>(
      `SELECT mq.quality_id, mq.release_id, mq.track_id, mq.dsp_compatibility_score, mq.overall_release_score, mq.created_at::text AS created_at, r.title, r.primary_artist
       FROM public.metadata_quality mq
       LEFT JOIN public.releases r ON r.id = mq.release_id
       ORDER BY mq.dsp_compatibility_score DESC, mq.created_at DESC
       LIMIT :limit`,
      { limit: Math.max(1, Math.trunc(limit)) },
    );
    return Object.freeze(rows.map((row) => ({
      qualityId: row.quality_id ?? null,
      releaseId: row.release_id ?? null,
      trackId: row.track_id ?? null,
      title: row.title ?? null,
      primaryArtist: row.primary_artist ?? null,
      dspCompatibilityScore: row.dsp_compatibility_score ?? null,
      overallReleaseScore: row.overall_release_score ?? null,
      createdAt: row.created_at ?? null,
    })));
  }

  private async getPublishingReportSummary(): Promise<Readonly<Record<string, unknown>>> {
    const rows = await this.sql.query<{ total_count: number; writers_count: number; publishers_count: number }>(
      `SELECT
         COUNT(*)::int AS total_count,
         COUNT(*) FILTER (WHERE kind IN ('writers', 'composers'))::int AS writers_count,
         COUNT(*) FILTER (WHERE kind IN ('publishers', 'copyright'))::int AS publishers_count
       FROM public.metadata_recommendations`,
    );
    const row = rows[0] ?? { total_count: 0, writers_count: 0, publishers_count: 0 };
    return Object.freeze({
      total: Number(row.total_count ?? 0),
      writers: Number(row.writers_count ?? 0),
      publishers: Number(row.publishers_count ?? 0),
    });
  }

  private async getPublishingReportItems(limit = 50): Promise<readonly unknown[]> {
    const rows = await this.sql.query<Readonly<Record<string, unknown>>>(
      `SELECT recommendation_id, release_id, track_id, kind, platform, field_name, message, severity, confidence_score, created_at::text AS created_at
       FROM public.metadata_recommendations
       WHERE kind IN ('writers', 'composers', 'publishers', 'copyright')
       ORDER BY created_at DESC
       LIMIT :limit`,
      { limit: Math.max(1, Math.trunc(limit)) },
    );
    return Object.freeze(rows.map((row) => ({
      recommendationId: row.recommendation_id ?? null,
      releaseId: row.release_id ?? null,
      trackId: row.track_id ?? null,
      kind: row.kind ?? null,
      platform: row.platform ?? null,
      fieldName: row.field_name ?? null,
      message: row.message ?? null,
      severity: row.severity ?? null,
      confidenceScore: row.confidence_score ?? null,
      createdAt: row.created_at ?? null,
    })));
  }

  private async getRightsReportSummary(): Promise<Readonly<Record<string, unknown>>> {
    const rows = await this.sql.query<{ total_count: number; rights_conflict_count: number; verified_count: number }>(
      `SELECT
         COUNT(*)::int AS total_count,
         COUNT(*) FILTER (WHERE conflict_kind IN ('duplicate_isrc', 'duplicate_upc', 'duplicate_release'))::int AS rights_conflict_count,
         COUNT(*) FILTER (WHERE conflict_kind NOT IN ('duplicate_isrc', 'duplicate_upc', 'duplicate_release'))::int AS verified_count
       FROM public.metadata_conflicts`,
    );
    const row = rows[0] ?? { total_count: 0, rights_conflict_count: 0, verified_count: 0 };
    return Object.freeze({
      total: Number(row.total_count ?? 0),
      rightsConflicts: Number(row.rights_conflict_count ?? 0),
      verified: Number(row.verified_count ?? 0),
    });
  }

  private async getRightsReportItems(limit = 50): Promise<readonly unknown[]> {
    const rows = await this.sql.query<Readonly<Record<string, unknown>>>(
      `SELECT conflict_id, release_id, track_id, conflict_kind, related_release_id, related_track_id, message, severity, evidence, created_at::text AS created_at
       FROM public.metadata_conflicts
       ORDER BY created_at DESC
       LIMIT :limit`,
      { limit: Math.max(1, Math.trunc(limit)) },
    );
    return Object.freeze(rows.map((row) => ({
      conflictId: row.conflict_id ?? null,
      releaseId: row.release_id ?? null,
      trackId: row.track_id ?? null,
      conflictKind: row.conflict_kind ?? null,
      relatedReleaseId: row.related_release_id ?? null,
      relatedTrackId: row.related_track_id ?? null,
      message: row.message ?? null,
      severity: row.severity ?? null,
      evidence: normalizeRecord(row.evidence),
      createdAt: row.created_at ?? null,
    })));
  }

  private async getReleaseReadinessSummary(): Promise<Readonly<Record<string, unknown>>> {
    const rows = await this.sql.query<{ ready_count: number; blocked_count: number; average_score: number | null }>(
      `SELECT
         COUNT(*) FILTER (WHERE overall_release_score >= 70)::int AS ready_count,
         COUNT(*) FILTER (WHERE overall_release_score < 70)::int AS blocked_count,
         AVG(overall_release_score)::numeric AS average_score
       FROM public.metadata_quality`,
    );
    const row = rows[0] ?? { ready_count: 0, blocked_count: 0, average_score: null };
    return Object.freeze({
      ready: Number(row.ready_count ?? 0),
      blocked: Number(row.blocked_count ?? 0),
      averageScore: row.average_score ?? null,
    });
  }

  private async getReleaseReadinessItems(limit = 50): Promise<readonly unknown[]> {
    const rows = await this.sql.query<Readonly<Record<string, unknown>>>(
      `SELECT mq.quality_id, mq.release_id, mq.track_id, mq.overall_release_score, mq.metadata_quality_score, mq.metadata_confidence_score, mq.created_at::text AS created_at, r.title, r.primary_artist
       FROM public.metadata_quality mq
       LEFT JOIN public.releases r ON r.id = mq.release_id
       ORDER BY mq.overall_release_score DESC, mq.created_at DESC
       LIMIT :limit`,
      { limit: Math.max(1, Math.trunc(limit)) },
    );
    return Object.freeze(rows.map((row) => ({
      qualityId: row.quality_id ?? null,
      releaseId: row.release_id ?? null,
      trackId: row.track_id ?? null,
      title: row.title ?? null,
      primaryArtist: row.primary_artist ?? null,
      overallReleaseScore: row.overall_release_score ?? null,
      metadataQualityScore: row.metadata_quality_score ?? null,
      metadataConfidenceScore: row.metadata_confidence_score ?? null,
      createdAt: row.created_at ?? null,
    })));
  }

  private async getRecommendationSummary(): Promise<Readonly<Record<string, unknown>>> {
    const rows = await this.sql.query<{ total_count: number; error_count: number; warning_count: number }>(
      `SELECT
         COUNT(*)::int AS total_count,
         COUNT(*) FILTER (WHERE severity = 'error')::int AS error_count,
         COUNT(*) FILTER (WHERE severity = 'warning')::int AS warning_count
       FROM public.metadata_recommendations`,
    );
    const row = rows[0] ?? { total_count: 0, error_count: 0, warning_count: 0 };
    return Object.freeze({
      total: Number(row.total_count ?? 0),
      errors: Number(row.error_count ?? 0),
      warnings: Number(row.warning_count ?? 0),
    });
  }

  private async getRecommendationItems(limit = 50): Promise<readonly unknown[]> {
    const rows = await this.sql.query<Readonly<Record<string, unknown>>>(
      `SELECT recommendation_id, release_id, track_id, kind, platform, field_name, message, severity, confidence_score, created_at::text AS created_at, metadata
       FROM public.metadata_recommendations
       ORDER BY created_at DESC
       LIMIT :limit`,
      { limit: Math.max(1, Math.trunc(limit)) },
    );
    return Object.freeze(rows.map((row) => ({
      recommendationId: row.recommendation_id ?? null,
      releaseId: row.release_id ?? null,
      trackId: row.track_id ?? null,
      kind: row.kind ?? null,
      platform: row.platform ?? null,
      fieldName: row.field_name ?? null,
      message: row.message ?? null,
      severity: row.severity ?? null,
      confidenceScore: row.confidence_score ?? null,
      createdAt: row.created_at ?? null,
      metadata: normalizeRecord(row.metadata),
    })));
  }

  private async getMetadataAuditReportSummary(): Promise<Readonly<Record<string, unknown>>> {
    const rows = await this.sql.query<{ total_count: number; latest_at: string | null }>(
      `SELECT COUNT(*)::int AS total_count, MAX(created_at)::text AS latest_at FROM public.metadata_audit`,
    );
    const row = rows[0] ?? { total_count: 0, latest_at: null };
    return Object.freeze({
      total: Number(row.total_count ?? 0),
      latestAt: row.latest_at ?? null,
    });
  }

  private async getMetadataAuditReportItems(limit = 50): Promise<readonly unknown[]> {
    const rows = await this.sql.query<Readonly<Record<string, unknown>>>(
      `SELECT audit_id, release_id, track_id, version_id, action, actor, status, validation_valid, correlation_id, created_at::text AS created_at, metadata
       FROM public.metadata_audit
       ORDER BY created_at DESC
       LIMIT :limit`,
      { limit: Math.max(1, Math.trunc(limit)) },
    );
    return Object.freeze(rows.map((row) => ({
      auditId: row.audit_id ?? null,
      releaseId: row.release_id ?? null,
      trackId: row.track_id ?? null,
      versionId: row.version_id ?? null,
      action: row.action ?? null,
      actor: row.actor ?? null,
      status: row.status ?? null,
      validationValid: row.validation_valid ?? null,
      correlationId: row.correlation_id ?? null,
      createdAt: row.created_at ?? null,
      metadata: normalizeRecord(row.metadata),
    })));
  }

  private async getIdentifierSummary(): Promise<Readonly<Record<string, unknown>>> {
    const rows = await this.sql.query<{ total_versions: number; duplicate_isrc_count: number; duplicate_upc_count: number }>(
      `SELECT
         COUNT(*)::int AS total_versions,
         COUNT(*) FILTER (WHERE diff IS NOT NULL)::int AS duplicate_isrc_count,
         COUNT(*) FILTER (WHERE fingerprint IS NOT NULL)::int AS duplicate_upc_count
       FROM public.metadata_versions`,
    );
    const row = rows[0] ?? { total_versions: 0, duplicate_isrc_count: 0, duplicate_upc_count: 0 };
    return Object.freeze({
      totalVersions: Number(row.total_versions ?? 0),
      duplicateIsrc: Number(row.duplicate_isrc_count ?? 0),
      duplicateUpc: Number(row.duplicate_upc_count ?? 0),
    });
  }

  private async getIdentifierItems(limit = 50): Promise<readonly unknown[]> {
    const rows = await this.sql.query<Readonly<Record<string, unknown>>>(
      `SELECT version_id, release_id, track_id, fingerprint, action, actor, correlation_id, created_at::text AS created_at, metadata, diff
       FROM public.metadata_versions
       ORDER BY created_at DESC
       LIMIT :limit`,
      { limit: Math.max(1, Math.trunc(limit)) },
    );
    return Object.freeze(rows.map((row) => ({
      versionId: row.version_id ?? null,
      releaseId: row.release_id ?? null,
      trackId: row.track_id ?? null,
      fingerprint: row.fingerprint ?? null,
      action: row.action ?? null,
      actor: row.actor ?? null,
      correlationId: row.correlation_id ?? null,
      createdAt: row.created_at ?? null,
      metadata: normalizeRecord(row.metadata),
      diff: normalizeRecord(row.diff),
    })));
  }

  private async getRoyaltyHealth(): Promise<Readonly<Record<string, unknown>>> {
    const [periodRows, statementRows, balanceRows] = await Promise.all([
      this.sql.query<{ open_periods: number }>("SELECT COUNT(*)::int AS open_periods FROM public.royalty_periods WHERE status IN ('open','processing')"),
      this.sql.query<{ generated_count: number; published_count: number; draft_count: number }>(
        `SELECT
           COUNT(*) FILTER (WHERE status = 'generated')::int AS generated_count,
           COUNT(*) FILTER (WHERE status = 'published')::int AS published_count,
           COUNT(*) FILTER (WHERE status = 'draft')::int AS draft_count
         FROM public.royalty_statements`,
      ),
      this.sql.query<{ total_payable: number | string | null }>(
        "SELECT COALESCE(SUM(payable_amount), 0)::numeric AS total_payable FROM public.royalty_statements WHERE status <> 'void'",
      ),
    ]);
    return Object.freeze({
      openPeriods: Number(periodRows[0]?.open_periods ?? 0),
      generatedStatements: Number(statementRows[0]?.generated_count ?? 0),
      publishedStatements: Number(statementRows[0]?.published_count ?? 0),
      draftStatements: Number(statementRows[0]?.draft_count ?? 0),
      totalPayable: Number(balanceRows[0]?.total_payable ?? 0),
    });
  }

  private async getRoyaltyExceptions(limit = 50): Promise<readonly unknown[]> {
    const rows = await this.sql.query<Readonly<Record<string, unknown>>>(
      `SELECT rs.id, rs.period_id, rs.user_id, rs.role, rs.statement_type, rs.gross_revenue, rs.net_revenue, rs.payable_amount, rs.currency, rs.status, rs.generated_at, rs.published_at
       FROM public.royalty_statements rs
       WHERE rs.status IN ('draft', 'void')
          OR rs.payable_amount = 0
       ORDER BY rs.updated_at DESC
       LIMIT :limit`,
      { limit: Math.max(1, Math.trunc(limit)) },
    );
    return Object.freeze(rows.map((row) => ({
      statementId: row.id ?? null,
      periodId: row.period_id ?? null,
      userId: row.user_id ?? null,
      role: row.role ?? null,
      statementType: row.statement_type ?? null,
      grossRevenue: row.gross_revenue ?? null,
      netRevenue: row.net_revenue ?? null,
      payableAmount: row.payable_amount ?? null,
      currency: row.currency ?? null,
      status: row.status ?? null,
      generatedAt: row.generated_at ?? null,
      publishedAt: row.published_at ?? null,
    })));
  }

  private async listRoyaltyPeriods(limit = 50): Promise<readonly EnterpriseRoyaltyPeriodItem[]> {
    const rows = await this.sql.query<Readonly<Record<string, unknown>>>(
      `SELECT rp.id,
              rp.period_type,
              rp.period_start::text AS period_start,
              rp.period_end::text AS period_end,
              rp.status,
              rp.closed_at::text AS closed_at,
              rp.published_at::text AS published_at,
              COUNT(rs.id)::int AS statement_count,
              COALESCE(SUM(rs.payable_amount), 0)::numeric AS total_payable_amount,
              MAX(rs.currency) AS currency
       FROM public.royalty_periods rp
       LEFT JOIN public.royalty_statements rs ON rs.period_id = rp.id
       GROUP BY rp.id
       ORDER BY rp.period_start DESC
       LIMIT :limit`,
      { limit: Math.max(1, Math.trunc(limit)) },
    );
    return Object.freeze(rows.map((row) => ({
      periodId: String(row.id ?? ""),
      periodType: String(row.period_type ?? ""),
      periodStart: String(row.period_start ?? ""),
      periodEnd: String(row.period_end ?? ""),
      status: String(row.status ?? ""),
      closedAt: normalizeMaybeString(row.closed_at),
      publishedAt: normalizeMaybeString(row.published_at),
      statementCount: Number(row.statement_count ?? 0),
      totalPayableAmount: Number(row.total_payable_amount ?? 0),
      currency: normalizeMaybeString(row.currency),
    })));
  }

  private async getDeliveryFailures(limit = 50): Promise<readonly unknown[]> {
    const rows = await this.sql.query<DistributionJobRow & { title: string | null; primary_artist: string | null }>(
      `SELECT dj.*, r.title, r.primary_artist
       FROM public.distribution_jobs dj
       LEFT JOIN public.releases r ON r.id = dj.release_id
       WHERE dj.status IN ('FAILED', 'DEAD_LETTER', 'REJECTED')
       ORDER BY dj.created_at DESC
       LIMIT :limit`,
      { limit: Math.max(1, Math.trunc(limit)) },
    );
    return Object.freeze(rows.map((row) => ({
      jobId: row.id,
      releaseId: row.release_id,
      title: row.title ?? "",
      primaryArtist: row.primary_artist ?? "",
      platform: row.platform,
      status: row.status,
      createdAt: row.created_at,
    })));
  }

  private async getDspErrors(limit = 50): Promise<readonly unknown[]> {
    const rows = await this.sql.query<Readonly<Record<string, unknown>>>(
      `SELECT release_id, track_id, provider, action, status, actor, metadata, created_at::text AS created_at
       FROM public.distribution_audit_logs
       WHERE status = 'FAILED'
       ORDER BY created_at DESC
       LIMIT :limit`,
      { limit: Math.max(1, Math.trunc(limit)) },
    );
    return Object.freeze(rows.map((row) => ({
      releaseId: row.release_id ?? null,
      trackId: row.track_id ?? null,
      provider: row.provider ?? null,
      action: row.action ?? "",
      status: row.status ?? "",
      actor: row.actor ?? "system",
      metadata: normalizeRecord(row.metadata),
      createdAt: row.created_at,
    })));
  }

  private async getRightsConflictReport(limit = 50): Promise<readonly unknown[]> {
    const rows = await this.sql.query<Readonly<Record<string, unknown>>>(
      `SELECT release_id, track_id, duplicate_type, severity, details, created_at::text AS created_at
       FROM public.release_duplicates
       WHERE severity = 'blocker'
       ORDER BY created_at DESC
       LIMIT :limit`,
      { limit: Math.max(1, Math.trunc(limit)) },
    );
    return Object.freeze(rows.map((row) => ({
      releaseId: row.release_id ?? null,
      trackId: row.track_id ?? null,
      duplicateType: row.duplicate_type ?? null,
      severity: row.severity ?? null,
      details: normalizeRecord(row.details),
      createdAt: row.created_at,
    })));
  }

  private async getRightsConflictSummary(): Promise<Readonly<Record<string, unknown>>> {
    const rows = await this.sql.query<{ count: number }>("SELECT COUNT(*)::int AS count FROM public.release_duplicates WHERE severity = 'blocker'");
    return Object.freeze({ blockerConflicts: Number(rows[0]?.count ?? 0) });
  }

  private async getDuplicateReleases(limit = 50): Promise<readonly unknown[]> {
    const rows = await this.sql.query<Readonly<Record<string, unknown>>>(
      `SELECT DISTINCT release_id, duplicate_type, severity, details, created_at::text AS created_at
       FROM public.release_duplicates
       ORDER BY created_at DESC
       LIMIT :limit`,
      { limit: Math.max(1, Math.trunc(limit)) },
    );
    return Object.freeze(rows.map((row) => ({
      releaseId: row.release_id ?? null,
      duplicateType: row.duplicate_type ?? null,
      severity: row.severity ?? null,
      details: normalizeRecord(row.details),
      createdAt: row.created_at,
    })));
  }

  private async getRejectedReleases(limit = 50): Promise<readonly unknown[]> {
    const rows = await this.sql.query<ReviewQueueRow & { title: string | null; primary_artist: string | null }>(
      `SELECT q.*, r.title, r.primary_artist
       FROM public.review_queue q
       JOIN public.releases r ON r.id = q.release_id
       WHERE q.queue_status = 'rejected'
       ORDER BY q.updated_at DESC
       LIMIT :limit`,
      { limit: Math.max(1, Math.trunc(limit)) },
    );
    return Object.freeze(rows.map((row) => this.toReviewQueueItem(row)));
  }

  private async getAuditReport(limit = 50): Promise<readonly EnterpriseAuditTrailEntry[]> {
    const rows = await this.sql.query<AuditTrailRow>(
      `SELECT source, entity_id, action, status, actor, created_at, metadata
       FROM (
         SELECT 'distribution_audit_logs' AS source,
                COALESCE(dal.release_id::text, dal.track_id::text, dal.distribution_job_id::text, 'unknown') AS entity_id,
                dal.action,
                dal.status,
                dal.actor,
                dal.created_at::text AS created_at,
                dal.metadata
         FROM public.distribution_audit_logs dal
         UNION ALL
         SELECT 'review_audit_log' AS source,
                ral.release_id::text AS entity_id,
                ral.action,
                ral.action::text AS status,
                COALESCE(ral.admin_id::text, 'system') AS actor,
                ral.created_at::text AS created_at,
                jsonb_build_object('notes', ral.notes, 'review_queue_id', ral.review_queue_id) AS metadata
         FROM public.review_audit_log ral
         UNION ALL
         SELECT 'fraud_audit_logs' AS source,
                COALESCE(fal.fraud_event_id::text, 'unknown') AS entity_id,
                fal.action,
                fal.action::text AS status,
                COALESCE(fal.actor_admin_id::text, 'system') AS actor,
                fal.created_at::text AS created_at,
                fal.metadata
         FROM public.fraud_audit_logs fal
       ) audit_entries
       ORDER BY created_at DESC
       LIMIT :limit`,
      { limit: Math.max(1, Math.trunc(limit)) },
    );
    return Object.freeze(rows.map((row) => ({
      source: row.source,
      entityId: row.entity_id,
      action: row.action,
      status: row.status,
      actor: row.actor,
      createdAt: row.created_at,
      metadata: normalizeRecord(row.metadata),
    })));
  }

  private async getFingerprintReportSummary(): Promise<Readonly<Record<string, unknown>>> {
    const rows = await this.sql.query<{ count: number; avg_confidence: number | null; duplicate_count: number | null; fraud_count: number | null }>(
      `SELECT
         COUNT(*)::int AS count,
         AVG(confidence_score) AS avg_confidence,
         COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM public.duplicate_matches dm WHERE dm.fingerprint_id = s.fingerprint_id))::int AS duplicate_count,
         COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM public.audio_analysis aa WHERE aa.fingerprint_id = s.fingerprint_id))::int AS fraud_count
       FROM public.audio_signatures s`,
    );
    const row = rows[0] ?? { count: 0, avg_confidence: null, duplicate_count: 0, fraud_count: 0 };
    return Object.freeze({
      totalFingerprints: Number(row.count ?? 0),
      averageConfidence: row.avg_confidence ?? 0,
      duplicateFingerprints: Number(row.duplicate_count ?? 0),
      fraudFingerprints: Number(row.fraud_count ?? 0),
    });
  }

  private async getFingerprintReportItems(limit = 50): Promise<readonly unknown[]> {
    const rows = await this.sql.query<Readonly<Record<string, unknown>>>(
      `SELECT s.fingerprint_id, s.release_id, s.track_id, s.release_title, s.track_title, s.primary_artist, s.label_name, s.isrc, s.upc, s.duration_seconds, s.sample_rate_hz, s.channels, s.zero_crossing_rate, s.silence_ratio, s.dynamic_range, s.bpm, s.confidence_score, s.created_at::text AS created_at
       FROM public.audio_signatures s
       ORDER BY s.created_at DESC
       LIMIT :limit`,
      { limit: Math.max(1, Math.trunc(limit)) },
    );
    return Object.freeze(rows.map((row) => ({
      fingerprintId: row.fingerprint_id ?? null,
      releaseId: row.release_id ?? null,
      trackId: row.track_id ?? null,
      releaseTitle: row.release_title ?? null,
      trackTitle: row.track_title ?? null,
      primaryArtist: row.primary_artist ?? null,
      labelName: row.label_name ?? null,
      isrc: row.isrc ?? null,
      upc: row.upc ?? null,
      durationSeconds: row.duration_seconds ?? null,
      sampleRateHz: row.sample_rate_hz ?? null,
      channels: row.channels ?? null,
      zeroCrossingRate: row.zero_crossing_rate ?? null,
      silenceRatio: row.silence_ratio ?? null,
      dynamicRange: row.dynamic_range ?? null,
      bpm: row.bpm ?? null,
      confidenceScore: row.confidence_score ?? null,
      createdAt: row.created_at ?? null,
    })));
  }

  private async getDuplicateReportSummary(): Promise<Readonly<Record<string, unknown>>> {
    const rows = await this.sql.query<{ count: number; exact_count: number; cross_release_count: number; cross_artist_count: number }>(
      `SELECT
         COUNT(*)::int AS count,
         COUNT(*) FILTER (WHERE duplicate_type = 'exact_duplicate')::int AS exact_count,
         COUNT(*) FILTER (WHERE duplicate_type = 'cross_release_duplicate')::int AS cross_release_count,
         COUNT(*) FILTER (WHERE duplicate_type = 'cross_artist_duplicate')::int AS cross_artist_count
       FROM public.duplicate_matches`,
    );
    const row = rows[0] ?? { count: 0, exact_count: 0, cross_release_count: 0, cross_artist_count: 0 };
    return Object.freeze({
      totalDuplicates: Number(row.count ?? 0),
      exactDuplicates: Number(row.exact_count ?? 0),
      crossReleaseDuplicates: Number(row.cross_release_count ?? 0),
      crossArtistDuplicates: Number(row.cross_artist_count ?? 0),
    });
  }

  private async getDuplicateReportItems(limit = 50): Promise<readonly unknown[]> {
    const rows = await this.sql.query<Readonly<Record<string, unknown>>>(
      `SELECT match_id, fingerprint_id, release_id, track_id, matched_release_id, matched_track_id, matched_fingerprint_id, duplicate_type, similarity_score, confidence_score, reasons, evidence, created_at::text AS created_at
       FROM public.duplicate_matches
       ORDER BY created_at DESC
       LIMIT :limit`,
      { limit: Math.max(1, Math.trunc(limit)) },
    );
    return Object.freeze(rows.map((row) => ({
      matchId: row.match_id ?? null,
      fingerprintId: row.fingerprint_id ?? null,
      releaseId: row.release_id ?? null,
      trackId: row.track_id ?? null,
      matchedReleaseId: row.matched_release_id ?? null,
      matchedTrackId: row.matched_track_id ?? null,
      matchedFingerprintId: row.matched_fingerprint_id ?? null,
      duplicateType: row.duplicate_type ?? null,
      similarityScore: row.similarity_score ?? null,
      confidenceScore: row.confidence_score ?? null,
      reasons: normalizeRecord(row.reasons),
      evidence: normalizeRecord(row.evidence),
      createdAt: row.created_at ?? null,
    })));
  }

  private async getSimilarityReportSummary(): Promise<Readonly<Record<string, unknown>>> {
    const rows = await this.sql.query<{ count: number; average_similarity: number | null; high_similarity: number | null }>(
      `SELECT
         COUNT(*)::int AS count,
         AVG(overall_similarity) AS average_similarity,
         COUNT(*) FILTER (WHERE overall_similarity >= 0.9)::int AS high_similarity
       FROM public.similarity_scores`,
    );
    const row = rows[0] ?? { count: 0, average_similarity: null, high_similarity: 0 };
    return Object.freeze({
      totalSimilarityScores: Number(row.count ?? 0),
      averageSimilarity: row.average_similarity ?? 0,
      highSimilarityScores: Number(row.high_similarity ?? 0),
    });
  }

  private async getSimilarityReportItems(limit = 50): Promise<readonly unknown[]> {
    const rows = await this.sql.query<Readonly<Record<string, unknown>>>(
      `SELECT similarity_id, fingerprint_id, release_id, track_id, compared_release_id, compared_track_id, waveform_similarity, spectral_similarity, tempo_similarity, pitch_similarity, silence_similarity, dynamic_range_similarity, rhythm_similarity, frequency_similarity, overall_similarity, confidence_score, created_at::text AS created_at
       FROM public.similarity_scores
       ORDER BY created_at DESC
       LIMIT :limit`,
      { limit: Math.max(1, Math.trunc(limit)) },
    );
    return Object.freeze(rows.map((row) => ({
      similarityId: row.similarity_id ?? null,
      fingerprintId: row.fingerprint_id ?? null,
      releaseId: row.release_id ?? null,
      trackId: row.track_id ?? null,
      comparedReleaseId: row.compared_release_id ?? null,
      comparedTrackId: row.compared_track_id ?? null,
      waveformSimilarity: row.waveform_similarity ?? null,
      spectralSimilarity: row.spectral_similarity ?? null,
      tempoSimilarity: row.tempo_similarity ?? null,
      pitchSimilarity: row.pitch_similarity ?? null,
      silenceSimilarity: row.silence_similarity ?? null,
      dynamicRangeSimilarity: row.dynamic_range_similarity ?? null,
      rhythmSimilarity: row.rhythm_similarity ?? null,
      frequencySimilarity: row.frequency_similarity ?? null,
      overallSimilarity: row.overall_similarity ?? null,
      confidenceScore: row.confidence_score ?? null,
      createdAt: row.created_at ?? null,
    })));
  }

  private async getAudioFraudReportSummary(): Promise<Readonly<Record<string, unknown>>> {
    const rows = await this.sql.query<{ count: number; high_severity: number | null }>(
      `SELECT
         COUNT(*)::int AS count,
         COUNT(*) FILTER (WHERE analysis_score >= 70)::int AS high_severity
       FROM public.audio_analysis`,
    );
    const row = rows[0] ?? { count: 0, high_severity: 0 };
    return Object.freeze({
      totalFraudSignals: Number(row.count ?? 0),
      highSeverityFraudSignals: Number(row.high_severity ?? 0),
    });
  }

  private async getAudioFraudReportItems(limit = 50): Promise<readonly unknown[]> {
    const rows = await this.sql.query<Readonly<Record<string, unknown>>>(
      `SELECT fingerprint_id, release_id, track_id, analysis_type, analysis_score, metadata, created_at::text AS created_at
       FROM public.audio_analysis
       ORDER BY created_at DESC
       LIMIT :limit`,
      { limit: Math.max(1, Math.trunc(limit)) },
    );
    return Object.freeze(rows.map((row) => ({
      fingerprintId: row.fingerprint_id ?? null,
      releaseId: row.release_id ?? null,
      trackId: row.track_id ?? null,
      analysisType: row.analysis_type ?? null,
      analysisScore: row.analysis_score ?? null,
      metadata: normalizeRecord(row.metadata),
      createdAt: row.created_at ?? null,
    })));
  }

  private async getRightsMatchReportSummary(): Promise<Readonly<Record<string, unknown>>> {
    const report = await this.getFingerprintReportSummary();
    return Object.freeze({
      ...report,
      rightsMatched: true,
    });
  }

  private async getRightsMatchReportItems(limit = 50): Promise<readonly unknown[]> {
    const rows = await this.sql.query<Readonly<Record<string, unknown>>>(
      `SELECT release_id, track_id, aggregate_type, aggregate_id, action, status, actor, metadata, created_at::text AS created_at
       FROM public.audit_events
       WHERE aggregate_type IN ('audio_fingerprint', 'rights_ownership', 'rights_license', 'rights_conflict', 'rights_withdrawal')
       ORDER BY created_at DESC
       LIMIT :limit`,
      { limit: Math.max(1, Math.trunc(limit)) },
    );
    return Object.freeze(rows.map((row) => ({
      releaseId: row.release_id ?? null,
      trackId: row.track_id ?? null,
      aggregateType: row.aggregate_type ?? null,
      aggregateId: row.aggregate_id ?? null,
      action: row.action ?? null,
      status: row.status ?? null,
      actor: row.actor ?? null,
      metadata: normalizeRecord(row.metadata),
      createdAt: row.created_at ?? null,
    })));
  }

  private async getCatalogDuplicateReportSummary(): Promise<Readonly<Record<string, unknown>>> {
    const rows = await this.sql.query<{ count: number; cross_catalog_count: number }>(
      `SELECT
         COUNT(*)::int AS count,
         COUNT(*) FILTER (WHERE duplicate_type IN ('cross_release_duplicate', 'cross_label_duplicate', 'cross_artist_duplicate', 'cross_catalog_duplicate'))::int AS cross_catalog_count
       FROM public.duplicate_matches`,
    );
    const row = rows[0] ?? { count: 0, cross_catalog_count: 0 };
    return Object.freeze({
      totalCatalogDuplicates: Number(row.count ?? 0),
      crossCatalogDuplicates: Number(row.cross_catalog_count ?? 0),
    });
  }

  private async getCatalogDuplicateReportItems(limit = 50): Promise<readonly unknown[]> {
    return this.getDuplicateReportItems(limit);
  }

  private async recordAuditLog(input: {
    entityType: string;
    entityId: string;
    releaseId: string | null;
    trackId?: string | null;
    distributionJobId?: string | null;
    action: string;
    status: string;
    actor: string;
    oldValue: unknown;
    newValue: unknown;
    reason: string | null;
    ipAddress: string | null;
    correlationId: string | null;
  }): Promise<void> {
    await this.sql.query(
      `INSERT INTO public.distribution_audit_logs (
         release_id,
         track_id,
         distribution_job_id,
         provider,
         action,
         status,
         actor,
         metadata
       ) VALUES (
         CASE WHEN :releaseId IS NOT NULL AND :releaseId <> '' THEN :releaseId::uuid ELSE NULL END,
         CASE WHEN :trackId IS NOT NULL AND :trackId <> '' THEN :trackId::uuid ELSE NULL END,
         CASE WHEN :distributionJobId IS NOT NULL AND :distributionJobId <> '' THEN :distributionJobId::uuid ELSE NULL END,
         'too_lost'::public.dsp_platform,
         :action,
         :status,
         :actor,
         CAST(:metadata AS jsonb)
       )`,
      {
        entityType: input.entityType,
        entityId: input.entityId,
        releaseId: input.releaseId,
        trackId: input.trackId ?? null,
        distributionJobId: input.distributionJobId ?? null,
        action: input.action,
        status: input.status,
        actor: input.actor,
        metadata: JSON.stringify({
          entityType: input.entityType,
          entityId: input.entityId,
          oldValue: input.oldValue,
          newValue: input.newValue,
          reason: input.reason,
          ipAddress: input.ipAddress,
          correlationId: input.correlationId,
        }),
      },
    );
  }

  private async queryOne<T extends object>(sql: string, params: Record<string, unknown>): Promise<T | null> {
    const rows = await this.sql.query<T>(sql, params);
    return rows[0] ?? null;
  }
}
