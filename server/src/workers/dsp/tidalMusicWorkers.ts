import { createWorker, type WorkerLike } from "../../queue/queueFactory";
import { queueNames } from "../../queue/queueNames";
import type { TidalDeliveryJob, TidalHealthJob, TidalPollingJob, TidalRetryJob, TidalWebhookJob } from "../../queue/jobTypes";
import type { EnterpriseOperationsService } from "../../distribution/admin/enterpriseOperationsService";
import type { DSPDeliveryJob } from "../../distribution/connectors/framework";
import type { Release } from "../../distribution/domain";
import { TidalEnterpriseService } from "../../distribution/connectors/framework/tidalConnector";

export type TidalWorkerDependencies = Readonly<{
  enterpriseService: TidalEnterpriseService;
  enterpriseOperationsService: EnterpriseOperationsService;
}>;

function releaseMetadata(release: Release): Record<string, unknown> {
  return (release.metadata ?? {}) as Record<string, unknown>;
}

function resolveEndpoint(release: Release): string | null {
  const metadata = releaseMetadata(release);
  const candidates = [
    metadata.tidalDeliveryEndpoint,
    metadata.tidalMusicDeliveryEndpoint,
    metadata.tidalMusicIngestionUrl,
    metadata.tidalStatusEndpoint,
    metadata.tidalHealthEndpoint,
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

function buildDeliveryJob(job: TidalDeliveryJob | TidalPollingJob | TidalRetryJob | TidalWebhookJob | TidalHealthJob): DSPDeliveryJob {
  if (!job.release) {
    throw new Error("TIDAL worker requires a release payload on the queue job.");
  }
  const releaseId = typeof (job as { releaseId?: string }).releaseId === "string" && (job as { releaseId?: string }).releaseId?.trim()
    ? (job as { releaseId?: string }).releaseId!.trim()
    : job.release.id.value;

  return {
    jobId: job.jobId ?? `${releaseId}:tidal`,
    releaseId,
    release: job.release,
    packageModel: job.packageModel ?? null,
    target: {
      connectorId: "Tidal",
      connectorVersion: "1.0.0",
      partnerName: "Tidal",
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
  dependencies: TidalWorkerDependencies,
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
    metadata: { connectorId: "Tidal" },
    ipAddress: null,
  });
}

export class TidalDeliveryWorker {
  constructor(private readonly dependencies: TidalWorkerDependencies) {}

  async process(job: TidalDeliveryJob): Promise<void> {
    const deliveryJob = buildDeliveryJob(job);
    const packageModel = await this.dependencies.enterpriseService.buildPackage(deliveryJob);
    const result = await this.dependencies.enterpriseService.deliver({ ...deliveryJob, packageModel });
    await recordAudit(this.dependencies, {
      aggregateId: deliveryJob.releaseId,
      action: result.success ? "TIDAL_MUSIC_DELIVERY_COMPLETED" : "TIDAL_MUSIC_DELIVERY_FAILED",
      actorUserId: job.actorUserId,
      correlationId: job.correlationId,
      reason: job.reason ?? null,
      metadata: this.dependencies.enterpriseService.generateDeliveryReport({ ...deliveryJob, packageModel }, result),
    });
  }
}

export class TidalPollingWorker {
  constructor(private readonly dependencies: TidalWorkerDependencies) {}

  async process(job: TidalPollingJob): Promise<void> {
    const deliveryJob = buildDeliveryJob(job);
    const packageModel = await this.dependencies.enterpriseService.buildPackage(deliveryJob);
    const status = await this.dependencies.enterpriseService.pollStatus({ ...deliveryJob, packageModel });
    await recordAudit(this.dependencies, {
      aggregateId: deliveryJob.releaseId,
      action: "TIDAL_MUSIC_STATUS_POLLED",
      actorUserId: job.actorUserId,
      correlationId: job.correlationId,
      reason: null,
      metadata: { status },
    });
  }
}

export class TidalRetryWorker {
  constructor(private readonly dependencies: TidalWorkerDependencies) {}

  async process(job: TidalRetryJob): Promise<void> {
    const deliveryJob = buildDeliveryJob(job);
    const packageModel = await this.dependencies.enterpriseService.buildPackage(deliveryJob);
    const retry = this.dependencies.enterpriseService.retry(new Error(job.reason ?? "TIDAL retry requested"), 0, { ...deliveryJob, packageModel });
    await recordAudit(this.dependencies, {
      aggregateId: deliveryJob.releaseId,
      action: retry.retryCount > 0 ? "TIDAL_MUSIC_RETRY_SCHEDULED" : "TIDAL_MUSIC_RETRY_SKIPPED",
      actorUserId: job.actorUserId,
      correlationId: job.correlationId,
      reason: job.reason ?? null,
      metadata: retry,
    });
  }
}

export class TidalWebhookWorker {
  constructor(private readonly dependencies: TidalWorkerDependencies) {}

  async process(job: TidalWebhookJob): Promise<void> {
    const releaseJob = buildDeliveryJob(job);
    const packageModel = await this.dependencies.enterpriseService.buildPackage(releaseJob);
    const webhookResult = await this.dependencies.enterpriseService.handleWebhook({
      webhookId: `tidal:${releaseJob.releaseId}:${job.eventType}`,
      connectorId: "Tidal",
      releaseId: releaseJob.releaseId,
      eventType: job.eventType,
      receivedAt: job.createdAt,
      headers: job.headers ?? {},
      payload: job.payload ?? {},
      signatureValid: job.signatureValid ?? false,
    });
    await recordAudit(this.dependencies, {
      aggregateId: releaseJob.releaseId,
      action: job.signatureValid === false ? "TIDAL_MUSIC_WEBHOOK_REJECTED" : "TIDAL_MUSIC_WEBHOOK_PROCESSED",
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

export class TidalHealthWorker {
  constructor(private readonly dependencies: TidalWorkerDependencies) {}

  async process(job: TidalHealthJob): Promise<void> {
    const deliveryJob = buildDeliveryJob(job);
    const packageModel = await this.dependencies.enterpriseService.buildPackage(deliveryJob);
    const health = await this.dependencies.enterpriseService.healthCheck({ ...deliveryJob, packageModel });
    await recordAudit(this.dependencies, {
      aggregateId: deliveryJob.releaseId,
      action: "TIDAL_MUSIC_HEALTH_CHECKED",
      actorUserId: job.actorUserId,
      correlationId: job.correlationId,
      reason: job.reason ?? null,
      metadata: this.dependencies.enterpriseService.generateHealthReport("Tidal", health),
    });
  }
}

export function registerTidalDeliveryWorker(worker: TidalDeliveryWorker, options: { concurrency?: number } = {}): WorkerLike {
  return createWorker(queueNames.tidalDelivery, async (job) => {
    await worker.process(job.data as TidalDeliveryJob);
  }, { concurrency: options.concurrency });
}

export function registerTidalPollingWorker(worker: TidalPollingWorker, options: { concurrency?: number } = {}): WorkerLike {
  return createWorker(queueNames.tidalPolling, async (job) => {
    await worker.process(job.data as TidalPollingJob);
  }, { concurrency: options.concurrency });
}

export function registerTidalRetryWorker(worker: TidalRetryWorker, options: { concurrency?: number } = {}): WorkerLike {
  return createWorker(queueNames.tidalRetry, async (job) => {
    await worker.process(job.data as TidalRetryJob);
  }, { concurrency: options.concurrency });
}

export function registerTidalWebhookWorker(worker: TidalWebhookWorker, options: { concurrency?: number } = {}): WorkerLike {
  return createWorker(queueNames.tidalWebhook, async (job) => {
    await worker.process(job.data as TidalWebhookJob);
  }, { concurrency: options.concurrency });
}

export function registerTidalHealthWorker(worker: TidalHealthWorker, options: { concurrency?: number } = {}): WorkerLike {
  return createWorker(queueNames.tidalHealth, async (job) => {
    await worker.process(job.data as TidalHealthJob);
  }, { concurrency: options.concurrency });
}

