import { createWorker, type WorkerLike } from "../../queue/queueFactory";
import { queueNames } from "../../queue/queueNames";
import type { TikTokDeliveryJob, TikTokHealthJob, TikTokPollingJob, TikTokRetryJob, TikTokWebhookJob } from "../../queue/jobTypes";
import type { EnterpriseOperationsService } from "../../distribution/admin/enterpriseOperationsService";
import type { DSPDeliveryJob } from "../../distribution/connectors/framework";
import type { Release } from "../../distribution/domain";
import { TikTokEnterpriseService } from "../../distribution/connectors/framework/tiktokConnector";

export type TikTokWorkerDependencies = Readonly<{
  enterpriseService: TikTokEnterpriseService;
  enterpriseOperationsService: EnterpriseOperationsService;
}>;

function releaseMetadata(release: Release): Record<string, unknown> {
  return (release.metadata ?? {}) as Record<string, unknown>;
}

function resolveEndpoint(release: Release): string | null {
  const metadata = releaseMetadata(release);
  const candidates = [
    metadata.TikTokDeliveryEndpoint,
    metadata.TikTokMusicDeliveryEndpoint,
    metadata.TikTokMusicIngestionUrl,
    metadata.TikTokStatusEndpoint,
    metadata.TikTokHealthEndpoint,
    metadata.dspDeliveryEndpoint,
    metadata.dspStatusEndpoint,
    metadata.dspHealthEndpoint,
    metadata.deliveryEndpointUrl,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
  }
  return null;
}

function resolveReleaseId(job: TikTokDeliveryJob | TikTokPollingJob | TikTokRetryJob | TikTokWebhookJob | TikTokHealthJob): string {
  const explicit = typeof job.releaseId === "string" ? job.releaseId.trim() : "";
  if (explicit) return explicit;
  const releaseId = job.release?.id;
  return typeof releaseId === "string" ? releaseId : "";
}

function buildDeliveryJob(job: TikTokDeliveryJob | TikTokPollingJob | TikTokRetryJob | TikTokWebhookJob | TikTokHealthJob): DSPDeliveryJob {
  if (!job.release) {
    throw new Error("TikTok worker requires a release payload on the queue job.");
  }
  const releaseId = resolveReleaseId(job);

  return {
    jobId: job.jobId ?? `${releaseId}:tiktok`,
    releaseId,
    release: job.release,
    packageModel: job.packageModel ?? null,
    target: {
      connectorId: "TikTok",
      connectorVersion: "1.0.0",
      partnerName: "TikTok",
      endpointUrl: resolveEndpoint(job.release),
      territories: job.release.territories.values.length ? job.release.territories.values : ["WORLD"],
      metadata: {
        actorUserId: job.actorUserId,
        correlationId: job.correlationId,
        sourceSystem: job.sourceSystem,
        reason: "reason" in job ? job.reason ?? null : null,
        eventType: "eventType" in job ? job.eventType : null,
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
  dependencies: TikTokWorkerDependencies,
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
    metadata: { connectorId: "TikTok" },
    ipAddress: null,
  });
}

export class TikTokDeliveryWorker {
  constructor(private readonly dependencies: TikTokWorkerDependencies) {}

  async process(job: TikTokDeliveryJob): Promise<void> {
    const deliveryJob = buildDeliveryJob(job);
    const packageModel = await this.dependencies.enterpriseService.buildPackage(deliveryJob);
    const result = await this.dependencies.enterpriseService.deliver({ ...deliveryJob, packageModel });
    await recordAudit(this.dependencies, {
      aggregateId: deliveryJob.releaseId,
      action: result.success ? "TIKTOK_MUSIC_DELIVERY_COMPLETED" : "TIKTOK_MUSIC_DELIVERY_FAILED",
      actorUserId: job.actorUserId,
      correlationId: job.correlationId,
      reason: job.reason ?? null,
      metadata: this.dependencies.enterpriseService.generateDeliveryReport({ ...deliveryJob, packageModel }, result),
    });
  }
}

export class TikTokPollingWorker {
  constructor(private readonly dependencies: TikTokWorkerDependencies) {}

  async process(job: TikTokPollingJob): Promise<void> {
    const deliveryJob = buildDeliveryJob(job);
    const packageModel = await this.dependencies.enterpriseService.buildPackage(deliveryJob);
    const status = await this.dependencies.enterpriseService.pollStatus({ ...deliveryJob, packageModel });
    await recordAudit(this.dependencies, {
      aggregateId: deliveryJob.releaseId,
      action: "TIKTOK_MUSIC_STATUS_POLLED",
      actorUserId: job.actorUserId,
      correlationId: job.correlationId,
      reason: null,
      metadata: { status },
    });
  }
}

export class TikTokRetryWorker {
  constructor(private readonly dependencies: TikTokWorkerDependencies) {}

  async process(job: TikTokRetryJob): Promise<void> {
    const deliveryJob = buildDeliveryJob(job);
    const packageModel = await this.dependencies.enterpriseService.buildPackage(deliveryJob);
    const retry = this.dependencies.enterpriseService.retry(new Error(job.reason ?? "TikTok retry requested"), 0, { ...deliveryJob, packageModel });
    await recordAudit(this.dependencies, {
      aggregateId: deliveryJob.releaseId,
      action: retry.retryCount > 0 ? "TIKTOK_MUSIC_RETRY_SCHEDULED" : "TIKTOK_MUSIC_RETRY_SKIPPED",
      actorUserId: job.actorUserId,
      correlationId: job.correlationId,
      reason: job.reason ?? null,
      metadata: retry,
    });
  }
}

export class TikTokWebhookWorker {
  constructor(private readonly dependencies: TikTokWorkerDependencies) {}

  async process(job: TikTokWebhookJob): Promise<void> {
    const deliveryJob = buildDeliveryJob(job);
    const packageModel = await this.dependencies.enterpriseService.buildPackage(deliveryJob);
    const webhookResult = await this.dependencies.enterpriseService.handleWebhook({
      webhookId: `TikTok:${deliveryJob.releaseId}:${job.eventType}`,
      connectorId: "TikTok",
      releaseId: deliveryJob.releaseId,
      eventType: job.eventType,
      receivedAt: job.createdAt,
      headers: job.headers ?? {},
      payload: job.payload ?? {},
      signatureValid: job.signatureValid ?? false,
    });
    await recordAudit(this.dependencies, {
      aggregateId: deliveryJob.releaseId,
      action: job.signatureValid === false ? "TIKTOK_MUSIC_WEBHOOK_REJECTED" : "TIKTOK_MUSIC_WEBHOOK_PROCESSED",
      actorUserId: job.actorUserId,
      correlationId: job.correlationId,
      reason: job.source ?? null,
      metadata: {
        ...webhookResult,
        report: this.dependencies.enterpriseService.generateMetadataReport({ ...deliveryJob, packageModel }),
      },
    });
  }
}

export class TikTokHealthWorker {
  constructor(private readonly dependencies: TikTokWorkerDependencies) {}

  async process(job: TikTokHealthJob): Promise<void> {
    const deliveryJob = buildDeliveryJob(job);
    const packageModel = await this.dependencies.enterpriseService.buildPackage(deliveryJob);
    const health = await this.dependencies.enterpriseService.healthCheck({ ...deliveryJob, packageModel });
    await recordAudit(this.dependencies, {
      aggregateId: deliveryJob.releaseId,
      action: "TIKTOK_MUSIC_HEALTH_CHECKED",
      actorUserId: job.actorUserId,
      correlationId: job.correlationId,
      reason: job.reason ?? null,
      metadata: this.dependencies.enterpriseService.generateHealthReport("TikTok", health),
    });
  }
}

export function registerTikTokDeliveryWorker(worker: TikTokDeliveryWorker, options: { concurrency?: number } = {}): WorkerLike {
  return createWorker(queueNames.tiktokDelivery, async (job) => {
    await worker.process(job.data as TikTokDeliveryJob);
  }, { concurrency: options.concurrency });
}

export function registerTikTokPollingWorker(worker: TikTokPollingWorker, options: { concurrency?: number } = {}): WorkerLike {
  return createWorker(queueNames.tiktokPolling, async (job) => {
    await worker.process(job.data as TikTokPollingJob);
  }, { concurrency: options.concurrency });
}

export function registerTikTokRetryWorker(worker: TikTokRetryWorker, options: { concurrency?: number } = {}): WorkerLike {
  return createWorker(queueNames.tiktokRetry, async (job) => {
    await worker.process(job.data as TikTokRetryJob);
  }, { concurrency: options.concurrency });
}

export function registerTikTokWebhookWorker(worker: TikTokWebhookWorker, options: { concurrency?: number } = {}): WorkerLike {
  return createWorker(queueNames.tiktokWebhook, async (job) => {
    await worker.process(job.data as TikTokWebhookJob);
  }, { concurrency: options.concurrency });
}

export function registerTikTokHealthWorker(worker: TikTokHealthWorker, options: { concurrency?: number } = {}): WorkerLike {
  return createWorker(queueNames.tiktokHealth, async (job) => {
    await worker.process(job.data as TikTokHealthJob);
  }, { concurrency: options.concurrency });
}




