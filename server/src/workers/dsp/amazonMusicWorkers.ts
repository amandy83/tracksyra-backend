import { createWorker, type WorkerLike } from "../../queue/queueFactory";
import { queueNames } from "../../queue/queueNames";
import type { AmazonMusicDeliveryJob, AmazonMusicHealthJob, AmazonMusicPollingJob, AmazonMusicRetryJob, AmazonMusicWebhookJob } from "../../queue/jobTypes";
import type { EnterpriseOperationsService } from "../../distribution/admin/enterpriseOperationsService";
import type { DSPDeliveryJob } from "../../distribution/connectors/framework";
import type { Release } from "../../distribution/domain";
import { AmazonMusicEnterpriseService } from "../../distribution/connectors/framework/amazonMusicConnector";

export type AmazonMusicWorkerDependencies = Readonly<{
  enterpriseService: AmazonMusicEnterpriseService;
  enterpriseOperationsService: EnterpriseOperationsService;
}>;

function releaseMetadata(release: Release): Record<string, unknown> {
  return (release.metadata ?? {}) as Record<string, unknown>;
}

function resolveEndpoint(release: Release): string | null {
  const metadata = releaseMetadata(release);
  const candidates = [
    metadata.amazonMusicDeliveryEndpoint,
    metadata.amazonDeliveryEndpoint,
    metadata.amazonMusicIngestionUrl,
    metadata.amazonMusicStatusEndpoint,
    metadata.amazonMusicHealthEndpoint,
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

function resolveReleaseId(job: AmazonMusicDeliveryJob | AmazonMusicPollingJob | AmazonMusicRetryJob | AmazonMusicWebhookJob | AmazonMusicHealthJob): string {
  const explicit = typeof job.releaseId === "string" ? job.releaseId.trim() : "";
  if (explicit) return explicit;
  const releaseId = job.release?.id;
  return typeof releaseId === "string" ? releaseId : "";
}

function buildDeliveryJob(job: AmazonMusicDeliveryJob | AmazonMusicPollingJob | AmazonMusicRetryJob | AmazonMusicWebhookJob | AmazonMusicHealthJob): DSPDeliveryJob {
  if (!job.release) {
    throw new Error("Amazon Music worker requires a release payload on the queue job.");
  }
  const releaseId = resolveReleaseId(job);

  return {
    jobId: job.jobId ?? `${releaseId}:amazonmusic`,
    releaseId,
    release: job.release,
    packageModel: job.packageModel ?? null,
    target: {
      connectorId: "AmazonMusic",
      connectorVersion: "1.0.0",
      partnerName: "AmazonMusic",
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
  dependencies: AmazonMusicWorkerDependencies,
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
    metadata: { connectorId: "AmazonMusic" },
    ipAddress: null,
  });
}

export class AmazonMusicDeliveryWorker {
  constructor(private readonly dependencies: AmazonMusicWorkerDependencies) {}

  async process(job: AmazonMusicDeliveryJob): Promise<void> {
    const deliveryJob = buildDeliveryJob(job);
    const packageModel = await this.dependencies.enterpriseService.buildPackage(deliveryJob);
    const result = await this.dependencies.enterpriseService.deliver({ ...deliveryJob, packageModel });
    await recordAudit(this.dependencies, {
      aggregateId: deliveryJob.releaseId,
      action: result.success ? "AMAZON_MUSIC_DELIVERY_COMPLETED" : "AMAZON_MUSIC_DELIVERY_FAILED",
      actorUserId: job.actorUserId,
      correlationId: job.correlationId,
      reason: job.reason ?? null,
      metadata: this.dependencies.enterpriseService.generateDeliveryReport({ ...deliveryJob, packageModel }, result),
    });
  }
}

export class AmazonMusicPollingWorker {
  constructor(private readonly dependencies: AmazonMusicWorkerDependencies) {}

  async process(job: AmazonMusicPollingJob): Promise<void> {
    const deliveryJob = buildDeliveryJob(job);
    const packageModel = await this.dependencies.enterpriseService.buildPackage(deliveryJob);
    const status = await this.dependencies.enterpriseService.pollStatus({ ...deliveryJob, packageModel });
    await recordAudit(this.dependencies, {
      aggregateId: deliveryJob.releaseId,
      action: "AMAZON_MUSIC_STATUS_POLLED",
      actorUserId: job.actorUserId,
      correlationId: job.correlationId,
      reason: null,
      metadata: { status },
    });
  }
}

export class AmazonMusicRetryWorker {
  constructor(private readonly dependencies: AmazonMusicWorkerDependencies) {}

  async process(job: AmazonMusicRetryJob): Promise<void> {
    const deliveryJob = buildDeliveryJob(job);
    const packageModel = await this.dependencies.enterpriseService.buildPackage(deliveryJob);
    const retry = this.dependencies.enterpriseService.retry(new Error(job.reason ?? "Amazon Music retry requested"), 0, { ...deliveryJob, packageModel });
    await recordAudit(this.dependencies, {
      aggregateId: deliveryJob.releaseId,
      action: retry.retryCount > 0 ? "AMAZON_MUSIC_RETRY_SCHEDULED" : "AMAZON_MUSIC_RETRY_SKIPPED",
      actorUserId: job.actorUserId,
      correlationId: job.correlationId,
      reason: job.reason ?? null,
      metadata: retry,
    });
  }
}

export class AmazonMusicWebhookWorker {
  constructor(private readonly dependencies: AmazonMusicWorkerDependencies) {}

  async process(job: AmazonMusicWebhookJob): Promise<void> {
    const deliveryJob = buildDeliveryJob(job);
    const packageModel = await this.dependencies.enterpriseService.buildPackage(deliveryJob);
    const webhookResult = await this.dependencies.enterpriseService.handleWebhook({
      webhookId: `amazon-music:${job.releaseId}:${job.eventType}`,
      connectorId: "AmazonMusic",
      releaseId: job.releaseId,
      eventType: job.eventType,
      receivedAt: job.createdAt,
      headers: job.headers ?? {},
      payload: job.payload ?? {},
      signatureValid: job.signatureValid ?? false,
    });
    await recordAudit(this.dependencies, {
      aggregateId: deliveryJob.releaseId,
      action: job.signatureValid === false ? "AMAZON_MUSIC_WEBHOOK_REJECTED" : "AMAZON_MUSIC_WEBHOOK_PROCESSED",
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

export class AmazonMusicHealthWorker {
  constructor(private readonly dependencies: AmazonMusicWorkerDependencies) {}

  async process(job: AmazonMusicHealthJob): Promise<void> {
    const deliveryJob = buildDeliveryJob(job);
    const packageModel = await this.dependencies.enterpriseService.buildPackage(deliveryJob);
    const health = await this.dependencies.enterpriseService.healthCheck({ ...deliveryJob, packageModel });
    await recordAudit(this.dependencies, {
      aggregateId: deliveryJob.releaseId,
      action: "AMAZON_MUSIC_HEALTH_CHECKED",
      actorUserId: job.actorUserId,
      correlationId: job.correlationId,
      reason: job.reason ?? null,
      metadata: this.dependencies.enterpriseService.generateHealthReport("AmazonMusic", health),
    });
  }
}

export function registerAmazonMusicDeliveryWorker(worker: AmazonMusicDeliveryWorker, options: { concurrency?: number } = {}): WorkerLike {
  return createWorker(queueNames.amazonMusicDelivery, async (job) => {
    await worker.process(job.data as AmazonMusicDeliveryJob);
  }, { concurrency: options.concurrency });
}

export function registerAmazonMusicPollingWorker(worker: AmazonMusicPollingWorker, options: { concurrency?: number } = {}): WorkerLike {
  return createWorker(queueNames.amazonMusicPolling, async (job) => {
    await worker.process(job.data as AmazonMusicPollingJob);
  }, { concurrency: options.concurrency });
}

export function registerAmazonMusicRetryWorker(worker: AmazonMusicRetryWorker, options: { concurrency?: number } = {}): WorkerLike {
  return createWorker(queueNames.amazonMusicRetry, async (job) => {
    await worker.process(job.data as AmazonMusicRetryJob);
  }, { concurrency: options.concurrency });
}

export function registerAmazonMusicWebhookWorker(worker: AmazonMusicWebhookWorker, options: { concurrency?: number } = {}): WorkerLike {
  return createWorker(queueNames.amazonMusicWebhook, async (job) => {
    await worker.process(job.data as AmazonMusicWebhookJob);
  }, { concurrency: options.concurrency });
}

export function registerAmazonMusicHealthWorker(worker: AmazonMusicHealthWorker, options: { concurrency?: number } = {}): WorkerLike {
  return createWorker(queueNames.amazonMusicHealth, async (job) => {
    await worker.process(job.data as AmazonMusicHealthJob);
  }, { concurrency: options.concurrency });
}
