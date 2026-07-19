import type { EnterpriseDistributionService, EnterpriseAuditContext } from "./enterpriseDistributionService";
import type { DistributionStore, SqlExecutor } from "../services/distributionStore";
import type { DistributionRelease, DistributionTrack } from "../models/distributionTypes";

type DeliveryQueueRow = Readonly<{
  id: string;
  release_id: string;
  track_id: string | null;
  platform: string;
  status: string;
  attempts: number;
  max_attempts: number;
  next_retry_at: string | null;
}>;

type DeliveryQueueStatus = "queued" | "preparing" | "packaging" | "validating" | "sending" | "waiting" | "delivered" | "rejected" | "retrying" | "failed" | "withdrawn";

function nowIso(): string {
  return new Date().toISOString();
}

function normalizeRecord(value: unknown): Readonly<Record<string, unknown>> {
  return value && typeof value === "object" ? Object.freeze({ ...(value as Record<string, unknown>) }) : Object.freeze({});
}

export class EnterpriseOperationsService {
  constructor(
    private readonly sql: SqlExecutor,
    private readonly distributionStore: DistributionStore,
    private readonly enterpriseDistributionService: EnterpriseDistributionService,
  ) {}

  async recordCatalogSnapshot(releaseId: string, audit: EnterpriseAuditContext): Promise<void> {
    const bundle = await this.distributionStore.getReleaseWithTracks(releaseId);
    if (!bundle) return;
    const report = await this.enterpriseDistributionService.getCatalogReport(releaseId);
    const readinessScore = report?.readinessScore ?? 0;
    const ownershipVerified = report?.ownershipVerified ?? false;
    const chainOfTitleVerified = report?.chainOfTitleVerified ?? false;

    await this.sql.query(
      `INSERT INTO public.catalog_health (
         release_id,
         overall_score,
         metadata_score,
         artwork_score,
         audio_score,
         rights_score,
         identifier_score,
         delivery_score,
         fraud_score,
         dsp_compliance_score,
         details
       ) VALUES (
         :releaseId,
         :overallScore,
         :metadataScore,
         :artworkScore,
         :audioScore,
         :rightsScore,
         :identifierScore,
         :deliveryScore,
         :fraudScore,
         :dspComplianceScore,
         CAST(:details AS jsonb)
       )`,
      {
        releaseId,
        overallScore: readinessScore,
        metadataScore: this.scoreForFlags(report?.validation?.filter((entry) => entry.validationType === "metadata") ?? []),
        artworkScore: this.scoreForFlags(report?.validation?.filter((entry) => entry.validationType === "artwork") ?? []),
        audioScore: this.scoreForFlags(report?.validation?.filter((entry) => entry.validationType === "audio") ?? []),
        rightsScore: ownershipVerified ? 100 : 50,
        identifierScore: (report?.identifierIssues?.length ?? 0) === 0 ? 100 : 40,
        deliveryScore: report?.stage === "Released" ? 100 : 60,
        fraudScore: (report?.moderationFlags?.length ?? 0) === 0 ? 100 : Math.max(0, 100 - (report?.moderationFlags?.length ?? 0) * 20),
        dspComplianceScore: chainOfTitleVerified ? 100 : 40,
        details: JSON.stringify({
          generatedAt: report?.auditTrail[0]?.createdAt ?? nowIso(),
          ownershipVerified,
          chainOfTitleVerified,
          rightsIssues: report?.rightsIssues ?? [],
          identifierIssues: report?.identifierIssues ?? [],
          moderationFlags: report?.moderationFlags ?? [],
          actor: audit.actor,
          correlationId: audit.correlationId,
        }),
      },
    );

    await this.recordAuditEvent({
      aggregateType: "catalog_health",
      aggregateId: releaseId,
      action: "CATALOG_SNAPSHOT_RECORDED",
      actor: audit.actor,
      reason: audit.reason,
      correlationId: audit.correlationId,
      oldValue: null,
      newValue: report,
      metadata: { rightsVerified: ownershipVerified, chainOfTitleVerified },
      ipAddress: audit.ipAddress,
    });
  }

  async recordRightsSnapshot(releaseId: string, audit: EnterpriseAuditContext): Promise<void> {
    const bundle = await this.distributionStore.getReleaseWithTracks(releaseId);
    if (!bundle) return;

    const releaseOwnership = this.buildReleaseOwnership(bundle.release, audit);
    const trackOwnership = bundle.tracks.map((track) => this.buildTrackOwnership(bundle.release, track, audit));
    for (const ownership of [releaseOwnership, ...trackOwnership]) {
      await this.sql.query(
        `INSERT INTO public.rights_ownership (
           release_id,
           track_id,
           owner_type,
           owner_name,
           rights_scope,
           territory,
           exclusive,
           status,
           source,
           metadata
         ) VALUES (
           :releaseId,
           :trackId,
           :ownerType,
           :ownerName,
           :rightsScope,
           :territory,
           :exclusive,
           :status,
           :source,
           CAST(:metadata AS jsonb)
         )
         ON CONFLICT DO NOTHING`,
        ownership,
      );

      await this.sql.query(
        `INSERT INTO public.ownership_history (
           ownership_id,
           release_id,
           track_id,
           action,
           old_value,
           new_value,
           reason,
           actor,
           correlation_id,
           ip_address,
           metadata
         ) VALUES (
           NULL,
           :releaseId,
           :trackId,
           'UPSERT',
           NULL,
           CAST(:newValue AS jsonb),
           :reason,
           :actor,
           :correlationId,
           :ipAddress::inet,
           CAST(:metadata AS jsonb)
         )`,
        {
          releaseId,
          trackId: ownership.trackId,
          newValue: JSON.stringify(ownership),
          reason: audit.reason,
          actor: audit.actor,
          correlationId: audit.correlationId,
          ipAddress: audit.ipAddress,
          metadata: JSON.stringify({ ownerType: ownership.ownerType, source: ownership.source }),
        },
      );
    }
  }

  async recordIdentifierHistory(releaseId: string, audit: EnterpriseAuditContext): Promise<void> {
    const report = await this.enterpriseDistributionService.getIdentifierReportByRelease(releaseId);
    if (!report) return;
    await this.sql.query(
      `INSERT INTO public.release_identifier_history (
         release_id,
         identifier_type,
         identifier_value,
         generated,
         source,
         metadata
       ) VALUES (
         :releaseId,
         :identifierType,
         :identifierValue,
         :generated,
         :source,
         CAST(:metadata AS jsonb)
       )`,
      {
        releaseId,
        identifierType: "upc",
        identifierValue: report.generatedUpc,
        generated: true,
        source: "system",
        metadata: JSON.stringify({ actor: audit.actor, correlationId: audit.correlationId }),
      },
    );
    for (const track of report.tracks) {
      await this.sql.query(
        `INSERT INTO public.release_identifier_history (
           release_id,
           track_id,
           identifier_type,
           identifier_value,
           generated,
           source,
           metadata
         ) VALUES (
           :releaseId,
           :trackId,
           'isrc',
           :identifierValue,
           :generated,
           :source,
           CAST(:metadata AS jsonb)
         )`,
        {
          releaseId,
          trackId: track.trackId,
          identifierValue: track.generatedIsrc,
          generated: true,
          source: "system",
          metadata: JSON.stringify({ actor: audit.actor, correlationId: audit.correlationId }),
        },
      );
    }
  }

  async queueDelivery(releaseId: string, audit: EnterpriseAuditContext): Promise<void> {
    const bundle = await this.distributionStore.getReleaseWithTracks(releaseId);
    if (!bundle) return;
    await this.sql.query(
      `INSERT INTO public.delivery_queue (
         release_id,
         track_id,
         provider,
         platform,
         status,
         priority,
         payload
       ) VALUES (
         :releaseId,
         NULL,
         'too_lost',
         'too_lost',
         'queued',
         50,
         CAST(:payload AS jsonb)
       )`,
      {
        releaseId,
        payload: JSON.stringify({
          releaseTitle: bundle.release.title,
          primaryArtist: bundle.release.primaryArtist,
          trackCount: bundle.tracks.length,
          requestedBy: audit.actor,
          correlationId: audit.correlationId,
        }),
      },
    );
    await this.recordAuditEvent({
      aggregateType: "delivery_queue",
      aggregateId: releaseId,
      action: "DELIVERY_QUEUED",
      actor: audit.actor,
      reason: audit.reason,
      correlationId: audit.correlationId,
      oldValue: null,
      newValue: { releaseId, trackCount: bundle.tracks.length },
      metadata: { stage: "queued" },
      ipAddress: audit.ipAddress,
    });
  }

  async queueSpotifyDelivery(releaseId: string, audit: EnterpriseAuditContext): Promise<void> {
    const bundle = await this.distributionStore.getReleaseWithTracks(releaseId);
    if (!bundle) return;
    await this.sql.query(
      `INSERT INTO public.delivery_queue (
         release_id,
         track_id,
         provider,
         platform,
         status,
         priority,
         payload
       ) VALUES (
         :releaseId,
         NULL,
         'spotify',
         'spotify',
         'queued',
         80,
         CAST(:payload AS jsonb)
       )`,
      {
        releaseId,
        payload: JSON.stringify({
          releaseTitle: bundle.release.title,
          primaryArtist: bundle.release.primaryArtist,
          trackCount: bundle.tracks.length,
          requestedBy: audit.actor,
          correlationId: audit.correlationId,
          connectorId: "Spotify",
        }),
      },
    );
    await this.recordAuditEvent({
      aggregateType: "delivery_queue",
      aggregateId: releaseId,
      action: "SPOTIFY_DELIVERY_QUEUED",
      actor: audit.actor,
      reason: audit.reason,
      correlationId: audit.correlationId,
      oldValue: null,
      newValue: { releaseId, trackCount: bundle.tracks.length, connectorId: "Spotify" },
      metadata: { stage: "queued", connectorId: "Spotify" },
      ipAddress: audit.ipAddress,
    });
  }

  async queueFingerprintReview(input: {
    releaseId: string;
    trackId?: string | null;
    reason: string;
    priority?: number;
    validationScore?: number;
    actor?: string | null;
    correlationId?: string | null;
    ipAddress?: string | null;
    metadata?: Readonly<Record<string, unknown>>;
  }): Promise<void> {
    await this.sql.query(
      `INSERT INTO public.review_queue (
         release_id,
         artist_id,
         queue_status,
         priority,
         validation_score,
         change_request_notes,
         escalation_reason,
         reviewed_at
       ) VALUES (
         :releaseId::uuid,
         (SELECT user_id FROM public.releases WHERE id = :releaseId::uuid LIMIT 1),
         'pending',
         :priority,
         :validationScore,
         :reason,
         'audio_fingerprint',
         NULL
       )
       ON CONFLICT (release_id) DO UPDATE SET
         queue_status = EXCLUDED.queue_status,
         priority = EXCLUDED.priority,
         validation_score = EXCLUDED.validation_score,
         change_request_notes = EXCLUDED.change_request_notes,
         escalation_reason = EXCLUDED.escalation_reason,
         updated_at = now()`,
      {
        releaseId: input.releaseId,
        priority: input.priority ?? 85,
        validationScore: input.validationScore ?? 20,
        reason: input.reason,
      },
    );
    await this.recordAuditEvent({
      aggregateType: "review_queue",
      aggregateId: input.releaseId,
      action: "FINGERPRINT_REVIEW_QUEUED",
      actor: input.actor ?? "system",
      reason: input.reason,
      correlationId: input.correlationId ?? null,
      oldValue: null,
      newValue: { releaseId: input.releaseId, trackId: input.trackId ?? null },
      metadata: input.metadata ?? {},
      ipAddress: input.ipAddress ?? null,
    });
  }

  async queueFingerprintFraud(input: {
    releaseId: string;
    trackId?: string | null;
    reason: string;
    score: number;
    actor?: string | null;
    correlationId?: string | null;
    ipAddress?: string | null;
    metadata?: Readonly<Record<string, unknown>>;
  }): Promise<void> {
    await this.sql.query(
      `SELECT public.append_fraud_signal(
         :eventId,
         'AUDIO_FINGERPRINT',
         'AUDIO_DUPLICATION',
         :score,
         CAST(:reasons AS jsonb),
         CAST(:featureVector AS jsonb),
         CAST(:rawEvent AS jsonb),
         CASE WHEN :trackId IS NOT NULL AND :trackId <> '' THEN :trackId::uuid ELSE NULL END,
         :releaseId::uuid,
         NULL,
         NULL::public.dsp_platform
       ) AS fraud_event_id`,
      {
        eventId: `audio-fingerprint:${input.releaseId}:${input.trackId ?? "release"}:${Date.now()}`,
        score: input.score,
        reasons: JSON.stringify([
          {
            rule: "AUDIO_DUPLICATION",
            severity: input.score >= 75 ? "high" : "medium",
            scoreImpact: input.score,
            explanation: input.reason,
            metadata: input.metadata ?? {},
          },
        ]),
        featureVector: JSON.stringify(input.metadata ?? {}),
        rawEvent: JSON.stringify({
          releaseId: input.releaseId,
          trackId: input.trackId ?? null,
          reason: input.reason,
          score: input.score,
        }),
        releaseId: input.releaseId,
        trackId: input.trackId ?? null,
      },
    );
    await this.recordAuditEvent({
      aggregateType: "fraud_scores",
      aggregateId: input.releaseId,
      action: "AUDIO_FRAUD_RECORDED",
      actor: input.actor ?? "system",
      reason: input.reason,
      correlationId: input.correlationId ?? null,
      oldValue: null,
      newValue: { score: input.score, trackId: input.trackId ?? null },
      metadata: input.metadata ?? {},
      ipAddress: input.ipAddress ?? null,
    });
  }

  async recordFingerprintOutcome(input: {
    releaseId: string;
    trackId?: string | null;
    fingerprintId?: string | null;
    duplicateCount: number;
    similarityCount: number;
    fraudCount: number;
    actor?: string | null;
    correlationId?: string | null;
    reason?: string | null;
    ipAddress?: string | null;
    metadata?: Readonly<Record<string, unknown>>;
  }): Promise<void> {
    await this.recordAuditEvent({
      aggregateType: "audio_fingerprint",
      aggregateId: input.releaseId,
      action: "FINGERPRINT_OUTCOME_RECORDED",
      actor: input.actor ?? "system",
      reason: input.reason ?? null,
      correlationId: input.correlationId ?? null,
      oldValue: null,
      newValue: {
        fingerprintId: input.fingerprintId ?? null,
        trackId: input.trackId ?? null,
        duplicateCount: input.duplicateCount,
        similarityCount: input.similarityCount,
        fraudCount: input.fraudCount,
      },
      metadata: input.metadata ?? {},
      ipAddress: input.ipAddress ?? null,
    });
  }

  async processDeliveryQueue(limit = 25): Promise<number> {
    const rows = await this.sql.query<DeliveryQueueRow>(
      `SELECT id, release_id, track_id, platform, status, attempts, max_attempts, next_retry_at
       FROM public.delivery_queue
       WHERE status IN ('queued', 'retrying')
       ORDER BY created_at ASC
       LIMIT :limit`,
      { limit: Math.max(1, Math.trunc(limit)) },
    );

    for (const row of rows) {
      const report = await this.enterpriseDistributionService.getCatalogReport(row.release_id);
      if (!report || !report.ownershipVerified || report.stage === "Rejected") {
        await this.markDelivery(row.id, "failed", "Release failed catalog or rights checks.");
        await this.sql.query(
          `INSERT INTO public.delivery_failures (
             delivery_queue_id,
             release_id,
             track_id,
             platform,
             reason,
             details
           ) VALUES (
             :deliveryQueueId,
             :releaseId,
             :trackId,
             :platform,
             :reason,
             CAST(:details AS jsonb)
           )`,
          {
            deliveryQueueId: row.id,
            releaseId: row.release_id,
            trackId: row.track_id,
            platform: row.platform,
            reason: "catalog_not_ready",
            details: JSON.stringify({ stage: report?.stage ?? "Unknown", readinessScore: report?.readinessScore ?? 0 }),
          },
        );
        continue;
      }

      await this.markDelivery(row.id, "sending", null);
      const bundle = await this.distributionStore.getReleaseWithTracks(row.release_id);
      if (!bundle) {
        await this.markDelivery(row.id, "failed", "Release missing from distribution store.");
        continue;
      }

      for (const track of bundle.tracks) {
        await this.distributionStore.createDistributionJob({
          releaseId: bundle.release.id,
          trackId: track.id,
          platform: "too_lost",
        });
      }

      await this.sql.query(
        `INSERT INTO public.delivery_attempts (
           delivery_queue_id,
           attempt_number,
           status,
           request,
           response
         ) VALUES (
           :deliveryQueueId,
           :attemptNumber,
           :status,
           CAST(:request AS jsonb),
           CAST(:response AS jsonb)
         )`,
        {
          deliveryQueueId: row.id,
          attemptNumber: row.attempts + 1,
          status: "sent",
          request: JSON.stringify({ releaseId: row.release_id, platform: row.platform }),
          response: JSON.stringify({ queuedJobs: bundle.tracks.length }),
        },
      );
      await this.markDelivery(row.id, "delivered", null);
    }

    return rows.length;
  }

  async scoreFraud(releaseId: string, audit: EnterpriseAuditContext): Promise<void> {
    const report = await this.enterpriseDistributionService.getCatalogReport(releaseId);
    if (!report) return;
    const score = Math.max(0, 100 - report.moderationFlags.length * 10 - report.duplicates.filter((entry) => entry.severity === "blocker").length * 15 - report.rightsIssues.length * 8);
    await this.sql.query(
      `INSERT INTO public.fraud_scores (
         release_id,
         fraud_type,
         score,
         reasons,
         evidence
       ) VALUES (
         :releaseId,
         'distribution',
         :score,
         CAST(:reasons AS jsonb),
         CAST(:evidence AS jsonb)
       )`,
      {
        releaseId,
        score,
        reasons: JSON.stringify([...report.rightsIssues, ...report.identifierIssues, ...report.moderationFlags]),
        evidence: JSON.stringify({ stage: report.stage, readinessScore: report.readinessScore, actor: audit.actor }),
      },
    );

    await this.recordAuditEvent({
      aggregateType: "fraud_scores",
      aggregateId: releaseId,
      action: "FRAUD_SCORE_RECORDED",
      actor: audit.actor,
      reason: audit.reason,
      correlationId: audit.correlationId,
      oldValue: null,
      newValue: { score, stage: report.stage },
      metadata: { moderationFlags: report.moderationFlags },
      ipAddress: audit.ipAddress,
    });
  }

  async recordSpotifyDeliveryOutcome(input: {
    releaseId: string;
    actor: string;
    correlationId: string | null;
    reason: string | null;
    success: boolean;
    connectorStatus: string | null;
    receipt: string | null;
    errors: readonly string[];
    warnings: readonly string[];
    metadata: Readonly<Record<string, unknown>>;
    ipAddress: string | null;
  }): Promise<void> {
    await this.recordAuditEvent({
      aggregateType: "delivery_queue",
      aggregateId: input.releaseId,
      action: input.success ? "SPOTIFY_DELIVERY_COMPLETED" : "SPOTIFY_DELIVERY_FAILED",
      actor: input.actor,
      reason: input.reason,
      correlationId: input.correlationId,
      oldValue: null,
      newValue: {
        connectorStatus: input.connectorStatus,
        receipt: input.receipt,
        success: input.success,
        errors: input.errors,
        warnings: input.warnings,
      },
      metadata: {
        connectorId: "Spotify",
        ...input.metadata,
      },
      ipAddress: input.ipAddress,
    });
  }

  async recordAuditEvent(input: {
    aggregateType: string;
    aggregateId: string;
    action: string;
    actor: string;
    reason: string | null;
    correlationId: string | null;
    oldValue: unknown;
    newValue: unknown;
    metadata: Readonly<Record<string, unknown>>;
    ipAddress: string | null;
  }): Promise<void> {
    await this.sql.query(
      `INSERT INTO public.audit_events (
         aggregate_type,
         aggregate_id,
         action,
         actor,
         ip_address,
         old_value,
         new_value,
         reason,
         correlation_id,
         metadata
       ) VALUES (
         :aggregateType,
         :aggregateId::uuid,
         :action,
         :actor,
         CASE WHEN :ipAddress IS NOT NULL AND :ipAddress <> '' THEN :ipAddress::inet ELSE NULL END,
         CAST(:oldValue AS jsonb),
         CAST(:newValue AS jsonb),
         :reason,
         :correlationId,
         CAST(:metadata AS jsonb)
       )`,
      {
        aggregateType: input.aggregateType,
        aggregateId: input.aggregateId,
        action: input.action,
        actor: input.actor,
        ipAddress: input.ipAddress,
        oldValue: JSON.stringify(input.oldValue),
        newValue: JSON.stringify(input.newValue),
        reason: input.reason,
        correlationId: input.correlationId,
        metadata: JSON.stringify(input.metadata),
      },
    );
  }

  private buildReleaseOwnership(release: DistributionRelease, audit: EnterpriseAuditContext) {
    return {
      releaseId: release.id,
      trackId: null,
      ownerType: "label",
      ownerName: release.labelName || release.primaryArtist || "Unknown",
      rightsScope: "sound_recording",
      territory: "WORLD",
      exclusive: true,
      status: release.rightsOwned ? "verified" : "pending",
      source: "system",
      metadata: JSON.stringify({ actor: audit.actor, releaseId: release.id, reason: audit.reason }),
    };
  }

  private buildTrackOwnership(release: DistributionRelease, track: DistributionTrack, audit: EnterpriseAuditContext) {
    return {
      releaseId: release.id,
      trackId: track.id,
      ownerType: "artist",
      ownerName: track.primaryArtist || release.primaryArtist || "Unknown",
      rightsScope: "sound_recording",
      territory: "WORLD",
      exclusive: true,
      status: track.isrc ? "verified" : "pending",
      source: "system",
      metadata: JSON.stringify({ actor: audit.actor, trackId: track.id, reason: audit.reason }),
    };
  }

  private scoreForFlags(entries: readonly { status: string }[]): number {
    if (!entries.length) return 100;
    let score = 100;
    for (const entry of entries) {
      if (entry.status === "failed") score -= 25;
      else if (entry.status === "warning") score -= 10;
      else score -= 2;
    }
    return Math.max(0, score);
  }

  private async markDelivery(deliveryQueueId: string, status: DeliveryQueueStatus, reason: string | null) {
    await this.sql.query(
      `UPDATE public.delivery_queue
       SET status = :status,
           updated_at = now(),
           attempts = CASE WHEN :status IN ('sending', 'retrying') THEN attempts + 1 ELSE attempts END,
           next_retry_at = CASE WHEN :status = 'retrying' THEN now() + interval '10 minutes' ELSE next_retry_at END
       WHERE id = :deliveryQueueId`,
      { deliveryQueueId, status, reason },
    );
  }
}
