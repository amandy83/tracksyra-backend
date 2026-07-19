import { createWorker, type WorkerLike } from "../../queue/queueFactory";
import { queueNames } from "../../queue/queueNames";
import type { YouTubeContentIdJob, YouTubeDeliveryJob, YouTubeHealthJob, YouTubePollingJob, YouTubeRetryJob, YouTubeWebhookJob } from "../../queue/jobTypes";
import type { EnterpriseOperationsService } from "../../distribution/admin/enterpriseOperationsService";
import type { DSPDeliveryJob } from "../../distribution/connectors/framework";
import type { Release } from "../../distribution/domain";
import { YouTubeEnterpriseService } from "../../distribution/connectors/framework/youtubeMusicConnector";

export type YouTubeWorkerDependencies = Readonly<{
  enterpriseService: YouTubeEnterpriseService;
  enterpriseOperationsService: EnterpriseOperationsService;
}>;

function releaseMetadata(release: Release): Record<string, unknown> {
  return (release.metadata ?? {}) as Record<string, unknown>;
}

function resolveEndpoint(release: Release): string | null {
  const metadata = releaseMetadata(release);
  const candidates = [
    metadata.youtubeDeliveryEndpoint,
    metadata.youtubeMusicDeliveryEndpoint,
    metadata.youtubeMusicIngestionUrl,
    metadata.youtubeCmsEndpoint,
    metadata.youtubeContentIdEndpoint,
    metadata.youtubeStatusEndpoint,
    metadata.youtubeHealthEndpoint,
    metadata.dspDeliveryEndpoint,
    metadata.dspStatusEndpoint,
    metadata.dspHealthEndpoint,
    metadata.deliveryEndpointUrl,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }
  return null;
}

function buildDeliveryJob(job: YouTubeDeliveryJob | YouTubePollingJob | YouTubeRetryJob | YouTubeWebhookJob | YouTubeHealthJob | YouTubeContentIdJob): DSPDeliveryJob {
  if (!job.release) {
    throw new Error("YouTube Music worker requires a release payload on the queue job.");
  }
  const releaseId = typeof (job as { releaseId?: string }).releaseId === "string" && (job as { releaseId?: string }).releaseId?.trim()
    ? (job as { releaseId?: string }).releaseId!.trim()
    : job.release.id.value;

  return {
    jobId: job.jobId ?? `${releaseId}:youtube`,
    releaseId,
    release: job.release,
    packageModel: job.packageModel ?? null,
    target: {
      connectorId: "YouTubeMusic",
      connectorVersion: "1.0.0",
      partnerName: "YouTubeMusic",
      endpointUrl: resolveEndpoint(job.release),
      territories: job.release.territories.values.length ? job.release.territories.values : ["WORLD"],
      metadata: {
        actorUserId: job.actorUserId,
        correlationId: job.correlationId,
        sourceSystem: job.sourceSystem,
        reason: "reason" in job ? job.reason ?? null : null,
        eventType: "eventType" in job ? job.eventType : null,
        assetId: "assetId" in job ? job.assetId ?? null : null,
        claimId: "claimId" in job ? job.claimId ?? null : null,
        policyId: "policyId" in job ? job.policyId ?? null : null,
        referenceType: "referenceType" in job ? job.referenceType ?? null : null,
      },
    },
    requestedBy: job.actorUserId ?? null,
    scheduledFor: null,
    metadata: {
      sourceSystem: job.sourceSystem,
      correlationId: job.correlationId,
      reason: "reason" in job ? job.reason ?? null : null,
      deliveryQueueId: "deliveryQueueId" in job ? job.deliveryQueueId ?? null : null,
    },
  };
}

async function recordAudit(
  dependencies: YouTubeWorkerDependencies,
  input: Readonly<{
    aggregateId: string;
    action: string;
    actorUserId: string | null;
    correlationId: string;
    reason: string | null;
    metadata?: Readonly<Record<string, unknown>>;
  }>,
): Promise<void> {
  await dependencies.enterpriseOperationsService.recordAuditEvent({
    aggregateType: "delivery_queue",
    aggregateId: input.aggregateId,
    action: input.action,
    actor: input.actorUserId ?? "system",
    reason: input.reason,
    correlationId: input.correlationId,
    oldValue: null,
    newValue: input.metadata ?? {},
    metadata: { connectorId: "YouTubeMusic" },
    ipAddress: null,
  });
}

export class YouTubeDeliveryWorker {
  constructor(private readonly dependencies: YouTubeWorkerDependencies) {}

  async process(job: YouTubeDeliveryJob): Promise<void> {
    const deliveryJob = buildDeliveryJob(job);
    const packageModel = await this.dependencies.enterpriseService.buildPackage(deliveryJob);
    const result = await this.dependencies.enterpriseService.deliver({ ...deliveryJob, packageModel });
    await recordAudit(this.dependencies, {
      aggregateId: deliveryJob.releaseId,
      action: result.success ? "YOUTUBE_MUSIC_DELIVERY_COMPLETED" : "YOUTUBE_MUSIC_DELIVERY_FAILED",
      actorUserId: job.actorUserId,
      correlationId: job.correlationId,
      reason: job.reason ?? null,
      metadata: this.dependencies.enterpriseService.generateDeliveryReport({ ...deliveryJob, packageModel }, result),
    });
  }
}

export class YouTubePollingWorker {
  constructor(private readonly dependencies: YouTubeWorkerDependencies) {}

  async process(job: YouTubePollingJob): Promise<void> {
    const deliveryJob = buildDeliveryJob(job);
    const packageModel = await this.dependencies.enterpriseService.buildPackage(deliveryJob);
    const status = await this.dependencies.enterpriseService.pollStatus({ ...deliveryJob, packageModel });
    await recordAudit(this.dependencies, {
      aggregateId: deliveryJob.releaseId,
      action: "YOUTUBE_MUSIC_STATUS_POLLED",
      actorUserId: job.actorUserId,
      correlationId: job.correlationId,
      reason: null,
      metadata: {
        status,
      },
    });
  }
}

export class YouTubeRetryWorker {
  constructor(private readonly dependencies: YouTubeWorkerDependencies) {}

  async process(job: YouTubeRetryJob): Promise<void> {
    const deliveryJob = buildDeliveryJob(job);
    const packageModel = await this.dependencies.enterpriseService.buildPackage(deliveryJob);
    const retry = this.dependencies.enterpriseService.retry(new Error(job.reason ?? "YouTube Music retry requested"), 0, { ...deliveryJob, packageModel });
    await recordAudit(this.dependencies, {
      aggregateId: deliveryJob.releaseId,
      action: retry.retryCount > 0 ? "YOUTUBE_MUSIC_RETRY_SCHEDULED" : "YOUTUBE_MUSIC_RETRY_SKIPPED",
      actorUserId: job.actorUserId,
      correlationId: job.correlationId,
      reason: job.reason ?? null,
      metadata: retry,
    });
  }
}

export class YouTubeWebhookWorker {
  constructor(private readonly dependencies: YouTubeWorkerDependencies) {}

  async process(job: YouTubeWebhookJob): Promise<void> {
    const releaseJob = buildDeliveryJob(job);
    const packageModel = await this.dependencies.enterpriseService.buildPackage(releaseJob);
    const webhookResult = await this.dependencies.enterpriseService.handleWebhook({
      webhookId: `youtube-music:${releaseJob.releaseId}:${job.eventType}`,
      connectorId: "YouTubeMusic",
      releaseId: releaseJob.releaseId,
      eventType: job.eventType,
      receivedAt: job.createdAt,
      headers: job.headers ?? {},
      payload: job.payload ?? {},
      signatureValid: job.signatureValid ?? false,
    });
    await recordAudit(this.dependencies, {
      aggregateId: releaseJob.releaseId,
      action: job.signatureValid === false ? "YOUTUBE_MUSIC_WEBHOOK_REJECTED" : "YOUTUBE_MUSIC_WEBHOOK_PROCESSED",
      actorUserId: job.actorUserId,
      correlationId: job.correlationId,
      reason: job.source ?? null,
      metadata: {
        ...webhookResult,
        report: this.dependencies.enterpriseService.generateMetadataReport({ ...releaseJob, packageModel }),
      },
    });
  }
}

export class YouTubeHealthWorker {
  constructor(private readonly dependencies: YouTubeWorkerDependencies) {}

  async process(job: YouTubeHealthJob): Promise<void> {
    const deliveryJob = buildDeliveryJob(job);
    const packageModel = await this.dependencies.enterpriseService.buildPackage(deliveryJob);
    const health = await this.dependencies.enterpriseService.healthCheck({ ...deliveryJob, packageModel });
    await recordAudit(this.dependencies, {
      aggregateId: deliveryJob.releaseId,
      action: "YOUTUBE_MUSIC_HEALTH_CHECKED",
      actorUserId: job.actorUserId,
      correlationId: job.correlationId,
      reason: job.reason ?? null,
      metadata: this.dependencies.enterpriseService.generateHealthReport("YouTubeMusic", health),
    });
  }
}

export class YouTubeContentIdWorker {
  constructor(private readonly dependencies: YouTubeWorkerDependencies) {}

  async process(job: YouTubeContentIdJob): Promise<void> {
    const deliveryJob = buildDeliveryJob(job);
    const packageModel = await this.dependencies.enterpriseService.buildPackage(deliveryJob);
    const action = (job.operation ?? "SYNC_REFERENCE").toUpperCase();
    let result: unknown;
    switch (action) {
      case "WITHDRAW_REFERENCE":
        result = await this.dependencies.enterpriseService.withdraw({ ...deliveryJob, packageModel });
        break;
      case "RESTORE_REFERENCE":
        result = await this.dependencies.enterpriseService.restore({ ...deliveryJob, packageModel });
        break;
      case "HEALTH_CHECK":
        result = await this.dependencies.enterpriseService.healthCheck({ ...deliveryJob, packageModel });
        break;
      case "RESOLVE_CLAIM":
        result = await this.dependencies.enterpriseService.pollStatus({ ...deliveryJob, packageModel });
        break;
      case "UPDATE_OWNERSHIP":
      case "SYNC_REFERENCE":
      default:
        result = await this.dependencies.enterpriseService.deliver({ ...deliveryJob, packageModel });
        break;
    }

    await recordAudit(this.dependencies, {
      aggregateId: deliveryJob.releaseId,
      action: `YOUTUBE_MUSIC_CONTENT_ID_${action}`,
      actorUserId: job.actorUserId,
      correlationId: job.correlationId,
      reason: job.reason ?? null,
      metadata: {
        result,
        contentIdReport: this.dependencies.enterpriseService.generateContentIdReport({ ...deliveryJob, packageModel }),
      },
    });
  }
}

export function registerYouTubeDeliveryWorker(worker: YouTubeDeliveryWorker, options: { concurrency?: number } = {}): WorkerLike {
  return createWorker(queueNames.youtubeDelivery, async (job) => {
    await worker.process(job.data as YouTubeDeliveryJob);
  }, { concurrency: options.concurrency });
}

export function registerYouTubePollingWorker(worker: YouTubePollingWorker, options: { concurrency?: number } = {}): WorkerLike {
  return createWorker(queueNames.youtubePolling, async (job) => {
    await worker.process(job.data as YouTubePollingJob);
  }, { concurrency: options.concurrency });
}

export function registerYouTubeRetryWorker(worker: YouTubeRetryWorker, options: { concurrency?: number } = {}): WorkerLike {
  return createWorker(queueNames.youtubeRetry, async (job) => {
    await worker.process(job.data as YouTubeRetryJob);
  }, { concurrency: options.concurrency });
}

export function registerYouTubeWebhookWorker(worker: YouTubeWebhookWorker, options: { concurrency?: number } = {}): WorkerLike {
  return createWorker(queueNames.youtubeWebhook, async (job) => {
    await worker.process(job.data as YouTubeWebhookJob);
  }, { concurrency: options.concurrency });
}

export function registerYouTubeHealthWorker(worker: YouTubeHealthWorker, options: { concurrency?: number } = {}): WorkerLike {
  return createWorker(queueNames.youtubeHealth, async (job) => {
    await worker.process(job.data as YouTubeHealthJob);
  }, { concurrency: options.concurrency });
}

export function registerYouTubeContentIdWorker(worker: YouTubeContentIdWorker, options: { concurrency?: number } = {}): WorkerLike {
  return createWorker(queueNames.youtubeContentId, async (job) => {
    await worker.process(job.data as YouTubeContentIdJob);
  }, { concurrency: options.concurrency });
}
