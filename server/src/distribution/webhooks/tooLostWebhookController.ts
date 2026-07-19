import { createHmac, timingSafeEqual } from "crypto";

import { DistributionAnalyticsService } from "../analytics";
import {
  DistributionIntelligenceStore,
  DistributionStatus,
  mapProviderStatus,
} from "../intelligence";
import type { DistributionPlatformName } from "../models/distributionTypes";
import type { DistributionStore, SqlExecutor } from "../services/distributionStore";
import { TooLostIntegrationService } from "../providers/too-lost";
import { captureException } from "../../observability/errorTracker";
import { loadRuntimeEnv } from "../../config/envLoader";
import { checkRateLimit, getClientIp, rateLimitRules, suspiciousActivityLog } from "../../security/rateLimiter";

export type TooLostWebhookEventType =
  | "RELEASE_APPROVED"
  | "RELEASE_REJECTED"
  | "RELEASE_DELIVERED"
  | "RELEASE_LIVE"
  | "RELEASE_TAKEDOWN";

export type NormalizedTooLostWebhookEvent = {
  eventId: string;
  type: TooLostWebhookEventType;
  releaseId: string;
  providerReleaseId: string;
  trackId?: string | null;
  providerTrackId?: string | null;
  platform: DistributionPlatformName;
  status: DistributionStatus;
  rawPayload: unknown;
};

type PendingTooLostWebhookEvent = Omit<NormalizedTooLostWebhookEvent, "releaseId" | "trackId">;

export type TooLostWebhookControllerDeps = {
  db: SqlExecutor;
  distributionStore: DistributionStore;
  syncService: TooLostIntegrationService;
  secret?: string;
  intelligenceStore: DistributionIntelligenceStore;
  analyticsService: DistributionAnalyticsService;
};

export class TooLostWebhookController {
  private readonly secret: string;
  private readonly intelligenceStore: DistributionIntelligenceStore;
  private readonly analyticsService: DistributionAnalyticsService;

  constructor(private deps: TooLostWebhookControllerDeps) {
    this.secret = deps.secret ?? readEnv("TOO_LOST_WEBHOOK_SECRET");
    this.intelligenceStore = deps.intelligenceStore;
    this.analyticsService = deps.analyticsService;
  }

  async handle(input: { body: string; headers: Record<string, string | string[] | undefined> }): Promise<{ ok: true; event: NormalizedTooLostWebhookEvent }> {
    const ip = getClientIp(input.headers);
    const rate = checkRateLimit(rateLimitRules.webhook, ip);
    if (!rate.allowed) {
      suspiciousActivityLog({ category: "webhook", ip, reason: "too_lost webhook rate limit" });
      throw new Error("Webhook rate limit exceeded");
    }

    let event: NormalizedTooLostWebhookEvent | null = null;
    try {
      this.verifySignature(input.body, input.headers);
      const payload = JSON.parse(input.body);
      event = await this.resolveEventTargets(this.normalize(payload));

      await this.persistRawWebhook(event);

      await this.deps.syncService.syncReleaseByProviderReleaseId(event.providerReleaseId, {
        localReleaseId: event.releaseId,
        source: "WEBHOOK",
      });
      await this.updateMatchingJobs(event);
      await this.updateReleaseLifecycle(event);
      void this.deps.syncService.refreshStatusCache("webhook");
      await this.analyticsService.refreshPlatformMetrics(event.platform);

      return { ok: true, event };
    } catch (error) {
      await captureException({
        error,
        context: { component: "too-lost-webhook", eventId: event?.eventId, releaseId: event?.releaseId, ip },
        tags: { webhook: "too_lost" },
      });
      throw error;
    }
  }

  normalize(payload: Record<string, unknown>): PendingTooLostWebhookEvent {
    const type = String(payload.type ?? payload.eventType ?? payload.event ?? "").toUpperCase() as TooLostWebhookEventType;
    const providerReleaseId = String(payload.releaseId ?? payload.release_id ?? payload.externalReleaseId ?? payload.tooLostReleaseId ?? "");
    if (!providerReleaseId) throw new Error("Webhook payload missing releaseId");

    return {
      eventId: String(payload.id ?? payload.eventId ?? `${type}:${providerReleaseId}:${payload.trackId ?? ""}`),
      type,
      providerReleaseId,
      providerTrackId: this.toString(payload.trackId) ?? this.toString(payload.track_id),
      platform: "too_lost",
      status: this.mapEventTypeToStatus(type, payload),
      rawPayload: payload,
    };
  }

  private async resolveEventTargets(event: PendingTooLostWebhookEvent): Promise<NormalizedTooLostWebhookEvent> {
    const resolved = await this.findLocalReleaseTarget(event.providerReleaseId, event.providerTrackId ?? null)
      ?? await this.findLocalReleaseTarget(event.providerReleaseId, null);
    if (!resolved) {
      throw new Error(`Too Lost webhook could not resolve local release for provider release ${event.providerReleaseId}.`);
    }
    return {
      ...event,
      releaseId: resolved.release_id,
      trackId: resolved.track_id ?? null,
    };
  }

  private async findLocalReleaseTarget(
    providerReleaseId: string,
    providerTrackId: string | null,
  ): Promise<{ release_id: string; track_id: string | null } | null> {
    const matches = await this.deps.db.query<{ release_id: string; track_id: string | null }>(
      `SELECT dj.release_id::text AS release_id,
              dj.track_id::text AS track_id
       FROM distribution_jobs dj
       LEFT JOIN platform_deliveries pd
         ON pd.release_id = dj.release_id
        AND pd.track_id = dj.track_id
        AND pd.platform = 'too_lost'
       WHERE dj.provider = 'too_lost'
         AND dj.provider_job_id = :providerReleaseId
         AND (:providerTrackId IS NULL OR pd.platform_track_id = :providerTrackId)
       ORDER BY dj.updated_at DESC
       LIMIT 1`,
      { providerReleaseId, providerTrackId },
    );
    return matches[0] ?? null;
  }

  private verifySignature(body: string, headers: Record<string, string | string[] | undefined>): void {
    if (!this.secret) return;
    const signature = header(headers, "x-too-lost-signature") ?? header(headers, "x-signature");
    if (!signature) throw new Error("Missing Too Lost webhook signature");

    const expected = createHmac("sha256", this.secret).update(body).digest("hex");
    const received = signature.replace(/^sha256=/, "");
    const expectedBuffer = Buffer.from(expected, "hex");
    const receivedBuffer = Buffer.from(received, "hex");
    if (expectedBuffer.length !== receivedBuffer.length || !timingSafeEqual(expectedBuffer, receivedBuffer)) {
      throw new Error("Invalid Too Lost webhook signature");
    }
  }

  private mapEventTypeToStatus(type: TooLostWebhookEventType, payload: Record<string, unknown>): DistributionStatus {
    if (typeof payload.status === "string" && payload.status.trim()) return mapProviderStatus(payload.status);
    switch (type) {
      case "RELEASE_APPROVED":
        return DistributionStatus.APPROVED;
      case "RELEASE_DELIVERED":
        return DistributionStatus.DELIVERED;
      case "RELEASE_LIVE":
        return DistributionStatus.PUBLISHED;
      case "RELEASE_REJECTED":
      case "RELEASE_TAKEDOWN":
        return DistributionStatus.REJECTED;
      default:
        return DistributionStatus.PROCESSING;
    }
  }

  private toString(value: unknown): string | null {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    return trimmed || null;
  }

  private async persistRawWebhook(event: NormalizedTooLostWebhookEvent): Promise<void> {
    await this.deps.db.query(
      `INSERT INTO distribution_events (
         event_id, provider, event_type, release_id, track_id, platform, normalized_status, raw_payload
       ) VALUES (
         :eventId, 'too_lost', :eventType, :releaseId, :trackId, :platform, :status, CAST(:rawPayload AS jsonb)
       )
       ON CONFLICT (provider, event_id) DO NOTHING
       RETURNING 1::int AS inserted`,
      {
        eventId: event.eventId,
        eventType: event.type,
        releaseId: event.releaseId,
        trackId: event.trackId ?? null,
        platform: event.platform,
        status: event.status,
        rawPayload: JSON.stringify(event.rawPayload),
      },
    );
  }

  private async updateMatchingJobs(event: NormalizedTooLostWebhookEvent): Promise<void> {
    await this.deps.db.query(
      `UPDATE distribution_jobs
       SET status = :status, updated_at = now(), processed_at = CASE WHEN :status IN ('DELIVERED', 'FAILED', 'REJECTED', 'PUBLISHED') THEN now() ELSE processed_at END
       WHERE release_id = :releaseId
         AND platform = 'too_lost'
         AND (:trackId IS NULL OR track_id = :trackId)`,
      { status: event.status, releaseId: event.releaseId, trackId: event.trackId ?? null },
    );
  }

  private async updateReleaseLifecycle(event: NormalizedTooLostWebhookEvent): Promise<void> {
    const nextReleaseStatus = this.toReleaseStatus(event.status);
    if (!nextReleaseStatus) return;
    await this.persistReleaseLifecycleStatus(event.releaseId, nextReleaseStatus);
  }

  private toReleaseStatus(status: DistributionStatus): string | null {
    if (status === DistributionStatus.PUBLISHED) return "live";
    if (status === DistributionStatus.DELIVERED) return "delivered";
    if (status === DistributionStatus.APPROVED) return "approved";
    if (status === DistributionStatus.IN_REVIEW) return "in_review";
    if (status === DistributionStatus.SUBMITTED || status === DistributionStatus.PROCESSING) return "processing";
    if (status === DistributionStatus.REJECTED || status === DistributionStatus.FAILED || status === DistributionStatus.DEAD_LETTER) return "rejected";
    return null;
  }

  private async persistReleaseLifecycleStatus(releaseId: string, desiredStatus: string): Promise<void> {
    const candidates = legacyReleaseStatus(desiredStatus);
    for (const status of candidates) {
      try {
        await this.deps.db.query(
          `UPDATE releases
           SET status = :status::public.release_status,
               submitted_at = COALESCE(submitted_at, now()),
               updated_at = now()
           WHERE id = :releaseId`,
          { releaseId, status },
        );
        return;
      } catch (error) {
        if (status !== candidates[candidates.length - 1]) continue;
        throw error;
      }
    }
  }
}

function header(headers: Record<string, string | string[] | undefined>, name: string): string | null {
  const entry = Object.entries(headers).find(([key]) => key.toLowerCase() === name.toLowerCase())?.[1];
  if (Array.isArray(entry)) return entry[0] ?? null;
  return entry ?? null;
}

function readEnv(key: string): string {
  loadRuntimeEnv();
  const env = process.env;
  return env?.[key] ?? "";
}

function legacyReleaseStatus(desiredStatus: string): string[] {
  if (desiredStatus === "in_review") return ["in_review", "under_review"];
  if (desiredStatus === "delivered") return ["delivered", "sent_to_stores"];
  return [desiredStatus];
}
