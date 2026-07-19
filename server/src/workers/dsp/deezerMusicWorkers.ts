import { createWorker, type WorkerLike } from "../../queue/queueFactory";
import { queueNames } from "../../queue/queueNames";
import type { DeezerDeliveryJob, DeezerHealthJob, DeezerPollingJob, DeezerRetryJob, DeezerWebhookJob } from "../../queue/jobTypes";
import type { EnterpriseOperationsService } from "../../distribution/admin/enterpriseOperationsService";
import type { DSPDeliveryJob } from "../../distribution/connectors/framework";
import type { Release } from "../../distribution/domain";
import { DeezerEnterpriseService } from "../../distribution/connectors/framework/deezerConnector";

export type DeezerWorkerDependencies = Readonly<{
  enterpriseService: DeezerEnterpriseService;
  enterpriseOperationsService: EnterpriseOperationsService;
}>;

function releaseMetadata(release: Release): Record<string, unknown> {
  return (release.metadata ?? {}) as Record<string, unknown>;
}

function resolveEndpoint(release: Release): string | null {
  const metadata = releaseMetadata(release);
  const candidates = [
    metadata.deezerDeliveryEndpoint,
    metadata.deezerMusicDeliveryEndpoint,
    metadata.deezerMusicIngestionUrl,
    metadata.deezerStatusEndpoint,
    metadata.deezerHealthEndpoint,
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

function buildDeliveryJob(job: DeezerDeliveryJob | DeezerPollingJob | DeezerRetryJob | DeezerWebhookJob | DeezerHealthJob): DSPDeliveryJob {
  if (!job.release) {
    throw new Error("Deezer worker requires a release payload on the queue job.");
  }
  const releaseId = typeof (job as { releaseId?: string }).releaseId === "string" && (job as { releaseId?: string }).releaseId?.trim()
    ? (job as { releaseId?: string }).releaseId!.trim()
    : job.release.id.value;

  return {
    jobId: job.jobId ?? `${releaseId}:deezer`,
    releaseId,
    release: job.release,
    packageModel: job.packageModel ?? null,
    target: {
      connectorId: "Deezer",
      connectorVersion: "1.0.0",
      partnerName: "Deezer",
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
  dependencies: DeezerWorkerDependencies,
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
    metadata: { connectorId: "Deezer" },
    ipAddress: null,
  });
}

export class DeezerDeliveryWorker {
  constructor(private readonly dependencies: DeezerWorkerDependencies) {}

  async process(job: DeezerDeliveryJob): Promise<void> {
    const deliveryJob = buildDeliveryJob(job);
    const packageModel = await this.dependencies.enterpriseService.buildPackage(deliveryJob);
    const result = await this.dependencies.enterpriseService.deliver({ ...deliveryJob, packageModel });
    await recordAudit(this.dependencies, {
      aggregateId: deliveryJob.releaseId,
      action: result.success ? "DEEZER_MUSIC_DELIVERY_COMPLETED" : "DEEZER_MUSIC_DELIVERY_FAILED",
      actorUserId: job.actorUserId,
      correlationId: job.correlationId,
      reason: job.reason ?? null,
      metadata: this.dependencies.enterpriseService.generateDeliveryReport({ ...deliveryJob, packageModel }, result),
    });
  }
}

export class DeezerPollingWorker {
  constructor(private readonly dependencies: DeezerWorkerDependencies) {}

  async process(job: DeezerPollingJob): Promise<void> {
    const deliveryJob = buildDeliveryJob(job);
    const packageModel = await this.dependencies.enterpriseService.buildPackage(deliveryJob);
    const status = await this.dependencies.enterpriseService.pollStatus({ ...deliveryJob, packageModel });
    await recordAudit(this.dependencies, {
      aggregateId: deliveryJob.releaseId,
      action: "DEEZER_MUSIC_STATUS_POLLED",
      actorUserId: job.actorUserId,
      correlationId: job.correlationId,
      reason: null,
      metadata: { status },
    });
  }
}

export class DeezerRetryWorker {
  constructor(private readonly dependencies: DeezerWorkerDependencies) {}

  async process(job: DeezerRetryJob): Promise<void> {
    const deliveryJob = buildDeliveryJob(job);
    const packageModel = await this.dependencies.enterpriseService.buildPackage(deliveryJob);
    const retry = this.dependencies.enterpriseService.retry(new Error(job.reason ?? "Deezer retry requested"), 0, { ...deliveryJob, packageModel });
    await recordAudit(this.dependencies, {
      aggregateId: deliveryJob.releaseId,
      action: retry.retryCount > 0 ? "DEEZER_MUSIC_RETRY_SCHEDULED" : "DEEZER_MUSIC_RETRY_SKIPPED",
      actorUserId: job.actorUserId,
      correlationId: job.correlationId,
      reason: job.reason ?? null,
      metadata: retry,
    });
  }
}

export class DeezerWebhookWorker {
  constructor(private readonly dependencies: DeezerWorkerDependencies) {}

  async process(job: DeezerWebhookJob): Promise<void> {
    const releaseJob = buildDeliveryJob(job);
    const packageModel = await this.dependencies.enterpriseService.buildPackage(releaseJob);
    const webhookResult = await this.dependencies.enterpriseService.handleWebhook({
      webhookId: `deezer:${releaseJob.releaseId}:${job.eventType}`,
      connectorId: "Deezer",
      releaseId: releaseJob.releaseId,
      eventType: job.eventType,
      receivedAt: job.createdAt,
      headers: job.headers ?? {},
      payload: job.payload ?? {},
      signatureValid: job.signatureValid ?? false,
    });
    await recordAudit(this.dependencies, {
      aggregateId: releaseJob.releaseId,
      action: job.signatureValid === false ? "DEEZER_MUSIC_WEBHOOK_REJECTED" : "DEEZER_MUSIC_WEBHOOK_PROCESSED",
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

export class DeezerHealthWorker {
  constructor(private readonly dependencies: DeezerWorkerDependencies) {}

  async process(job: DeezerHealthJob): Promise<void> {
    const deliveryJob = buildDeliveryJob(job);
    const packageModel = await this.dependencies.enterpriseService.buildPackage(deliveryJob);
    const health = await this.dependencies.enterpriseService.healthCheck({ ...deliveryJob, packageModel });
    await recordAudit(this.dependencies, {
      aggregateId: deliveryJob.releaseId,
      action: "DEEZER_MUSIC_HEALTH_CHECKED",
      actorUserId: job.actorUserId,
      correlationId: job.correlationId,
      reason: job.reason ?? null,
      metadata: this.dependencies.enterpriseService.generateHealthReport("Deezer", health),
    });
  }
}

export function registerDeezerDeliveryWorker(worker: DeezerDeliveryWorker, options: { concurrency?: number } = {}): WorkerLike {
  return createWorker(queueNames.deezerDelivery, async (job) => {
    await worker.process(job.data as DeezerDeliveryJob);
  }, { concurrency: options.concurrency });
}

export function registerDeezerPollingWorker(worker: DeezerPollingWorker, options: { concurrency?: number } = {}): WorkerLike {
  return createWorker(queueNames.deezerPolling, async (job) => {
    await worker.process(job.data as DeezerPollingJob);
  }, { concurrency: options.concurrency });
}

export function registerDeezerRetryWorker(worker: DeezerRetryWorker, options: { concurrency?: number } = {}): WorkerLike {
  return createWorker(queueNames.deezerRetry, async (job) => {
    await worker.process(job.data as DeezerRetryJob);
  }, { concurrency: options.concurrency });
}

export function registerDeezerWebhookWorker(worker: DeezerWebhookWorker, options: { concurrency?: number } = {}): WorkerLike {
  return createWorker(queueNames.deezerWebhook, async (job) => {
    await worker.process(job.data as DeezerWebhookJob);
  }, { concurrency: options.concurrency });
}

export function registerDeezerHealthWorker(worker: DeezerHealthWorker, options: { concurrency?: number } = {}): WorkerLike {
  return createWorker(queueNames.deezerHealth, async (job) => {
    await worker.process(job.data as DeezerHealthJob);
  }, { concurrency: options.concurrency });
}
