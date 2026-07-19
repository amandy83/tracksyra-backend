import { createWorker, type WorkerLike } from "../../queue/queueFactory";
import { queueNames } from "../../queue/queueNames";
import type { MetaDeliveryJob, MetaHealthJob, MetaPollingJob, MetaRetryJob, MetaWebhookJob } from "../../queue/jobTypes";
import type { EnterpriseOperationsService } from "../../distribution/admin/enterpriseOperationsService";
import type { DSPDeliveryJob } from "../../distribution/connectors/framework";
import type { Release } from "../../distribution/domain";
import { MetaRightsEnterpriseService } from "../../distribution/connectors/framework/metaRightsManagerConnector";

export type MetaWorkerDependencies = Readonly<{
  enterpriseService: MetaRightsEnterpriseService;
  enterpriseOperationsService: EnterpriseOperationsService;
}>;

function releaseMetadata(release: Release): Record<string, unknown> {
  return (release.metadata ?? {}) as Record<string, unknown>;
}

function resolveEndpoint(release: Release): string | null {
  const metadata = releaseMetadata(release);
  const candidates = [
    metadata.MetaDeliveryEndpoint,
    metadata.MetaMusicDeliveryEndpoint,
    metadata.MetaMusicIngestionUrl,
    metadata.MetaStatusEndpoint,
    metadata.MetaHealthEndpoint,
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

function resolveReleaseId(job: MetaDeliveryJob | MetaPollingJob | MetaRetryJob | MetaWebhookJob | MetaHealthJob): string {
  const explicit = typeof job.releaseId === "string" ? job.releaseId.trim() : "";
  if (explicit) return explicit;
  const releaseId = job.release?.id;
  return typeof releaseId === "string" ? releaseId : "";
}

function buildDeliveryJob(job: MetaDeliveryJob | MetaPollingJob | MetaRetryJob | MetaWebhookJob | MetaHealthJob): DSPDeliveryJob {
  if (!job.release) {
    throw new Error("Meta worker requires a release payload on the queue job.");
  }
  const releaseId = resolveReleaseId(job);

  return {
    jobId: job.jobId ?? `${releaseId}:meta`,
    releaseId,
    release: job.release,
    packageModel: job.packageModel ?? null,
    target: {
      connectorId: "Meta",
      connectorVersion: "1.0.0",
      partnerName: "Meta",
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
  dependencies: MetaWorkerDependencies,
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
    metadata: { connectorId: "Meta" },
    ipAddress: null,
  });
}

export class MetaDeliveryWorker {
  constructor(private readonly dependencies: MetaWorkerDependencies) {}

  async process(job: MetaDeliveryJob): Promise<void> {
    const deliveryJob = buildDeliveryJob(job);
    const packageModel = await this.dependencies.enterpriseService.buildPackage(deliveryJob);
    const result = await this.dependencies.enterpriseService.deliver({ ...deliveryJob, packageModel });
    await recordAudit(this.dependencies, {
      aggregateId: deliveryJob.releaseId,
      action: result.success ? "META_MUSIC_DELIVERY_COMPLETED" : "META_MUSIC_DELIVERY_FAILED",
      actorUserId: job.actorUserId,
      correlationId: job.correlationId,
      reason: job.reason ?? null,
      metadata: this.dependencies.enterpriseService.generateDeliveryReport({ ...deliveryJob, packageModel }, result),
    });
  }
}

export class MetaPollingWorker {
  constructor(private readonly dependencies: MetaWorkerDependencies) {}

  async process(job: MetaPollingJob): Promise<void> {
    const deliveryJob = buildDeliveryJob(job);
    const packageModel = await this.dependencies.enterpriseService.buildPackage(deliveryJob);
    const status = await this.dependencies.enterpriseService.pollStatus({ ...deliveryJob, packageModel });
    await recordAudit(this.dependencies, {
      aggregateId: deliveryJob.releaseId,
      action: "META_MUSIC_STATUS_POLLED",
      actorUserId: job.actorUserId,
      correlationId: job.correlationId,
      reason: null,
      metadata: { status },
    });
  }
}

export class MetaRetryWorker {
  constructor(private readonly dependencies: MetaWorkerDependencies) {}

  async process(job: MetaRetryJob): Promise<void> {
    const deliveryJob = buildDeliveryJob(job);
    const packageModel = await this.dependencies.enterpriseService.buildPackage(deliveryJob);
    const retry = this.dependencies.enterpriseService.retry(new Error(job.reason ?? "Meta retry requested"), 0, { ...deliveryJob, packageModel });
    await recordAudit(this.dependencies, {
      aggregateId: deliveryJob.releaseId,
      action: retry.retryCount > 0 ? "META_MUSIC_RETRY_SCHEDULED" : "META_MUSIC_RETRY_SKIPPED",
      actorUserId: job.actorUserId,
      correlationId: job.correlationId,
      reason: job.reason ?? null,
      metadata: retry,
    });
  }
}

export class MetaWebhookWorker {
  constructor(private readonly dependencies: MetaWorkerDependencies) {}

  async process(job: MetaWebhookJob): Promise<void> {
    const deliveryJob = buildDeliveryJob(job);
    const packageModel = await this.dependencies.enterpriseService.buildPackage(deliveryJob);
    const webhookResult = await this.dependencies.enterpriseService.handleWebhook({
      webhookId: `Meta:${deliveryJob.releaseId}:${job.eventType}`,
      connectorId: "Meta",
      releaseId: deliveryJob.releaseId,
      eventType: job.eventType,
      receivedAt: job.createdAt,
      headers: job.headers ?? {},
      payload: job.payload ?? {},
      signatureValid: job.signatureValid ?? false,
    });
    await recordAudit(this.dependencies, {
      aggregateId: deliveryJob.releaseId,
      action: job.signatureValid === false ? "META_MUSIC_WEBHOOK_REJECTED" : "META_MUSIC_WEBHOOK_PROCESSED",
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

export class MetaHealthWorker {
  constructor(private readonly dependencies: MetaWorkerDependencies) {}

  async process(job: MetaHealthJob): Promise<void> {
    const deliveryJob = buildDeliveryJob(job);
    const packageModel = await this.dependencies.enterpriseService.buildPackage(deliveryJob);
    const health = await this.dependencies.enterpriseService.healthCheck({ ...deliveryJob, packageModel });
    await recordAudit(this.dependencies, {
      aggregateId: deliveryJob.releaseId,
      action: "META_MUSIC_HEALTH_CHECKED",
      actorUserId: job.actorUserId,
      correlationId: job.correlationId,
      reason: job.reason ?? null,
      metadata: this.dependencies.enterpriseService.generateHealthReport("Meta", health),
    });
  }
}

export function registerMetaDeliveryWorker(worker: MetaDeliveryWorker, options: { concurrency?: number } = {}): WorkerLike {
  return createWorker(queueNames.metaDelivery, async (job) => {
    await worker.process(job.data as MetaDeliveryJob);
  }, { concurrency: options.concurrency });
}

export function registerMetaPollingWorker(worker: MetaPollingWorker, options: { concurrency?: number } = {}): WorkerLike {
  return createWorker(queueNames.metaPolling, async (job) => {
    await worker.process(job.data as MetaPollingJob);
  }, { concurrency: options.concurrency });
}

export function registerMetaRetryWorker(worker: MetaRetryWorker, options: { concurrency?: number } = {}): WorkerLike {
  return createWorker(queueNames.metaRetry, async (job) => {
    await worker.process(job.data as MetaRetryJob);
  }, { concurrency: options.concurrency });
}

export function registerMetaWebhookWorker(worker: MetaWebhookWorker, options: { concurrency?: number } = {}): WorkerLike {
  return createWorker(queueNames.metaWebhook, async (job) => {
    await worker.process(job.data as MetaWebhookJob);
  }, { concurrency: options.concurrency });
}

export function registerMetaHealthWorker(worker: MetaHealthWorker, options: { concurrency?: number } = {}): WorkerLike {
  return createWorker(queueNames.metaHealth, async (job) => {
    await worker.process(job.data as MetaHealthJob);
  }, { concurrency: options.concurrency });
}




