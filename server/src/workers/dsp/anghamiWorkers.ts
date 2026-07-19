import { createWorker, type WorkerLike } from "../../queue/queueFactory";
import { queueNames } from "../../queue/queueNames";
import type { AnghamiDeliveryJob, AnghamiHealthJob, AnghamiPollingJob, AnghamiRetryJob, AnghamiWebhookJob } from "../../queue/jobTypes";
import type { EnterpriseOperationsService } from "../../distribution/admin/enterpriseOperationsService";
import type { DSPDeliveryJob } from "../../distribution/connectors/framework";
import type { Release } from "../../distribution/domain";
import { AnghamiEnterpriseService } from "../../distribution/connectors/framework/anghamiConnector";

export type AnghamiWorkerDependencies = Readonly<{
  enterpriseService: AnghamiEnterpriseService;
  enterpriseOperationsService: EnterpriseOperationsService;
}>;

function releaseMetadata(release: Release): Record<string, unknown> {
  return (release.metadata ?? {}) as Record<string, unknown>;
}

function resolveEndpoint(release: Release): string | null {
  const metadata = releaseMetadata(release);
  const candidates = [
    metadata.AnghamiDeliveryEndpoint,
    metadata.AnghamiMusicDeliveryEndpoint,
    metadata.AnghamiMusicIngestionUrl,
    metadata.AnghamiStatusEndpoint,
    metadata.AnghamiHealthEndpoint,
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

function resolveReleaseId(job: AnghamiDeliveryJob | AnghamiPollingJob | AnghamiRetryJob | AnghamiWebhookJob | AnghamiHealthJob): string {
  const explicit = typeof job.releaseId === "string" ? job.releaseId.trim() : "";
  if (explicit) return explicit;
  const releaseId = job.release?.id;
  return typeof releaseId === "string" ? releaseId : "";
}

function buildDeliveryJob(job: AnghamiDeliveryJob | AnghamiPollingJob | AnghamiRetryJob | AnghamiWebhookJob | AnghamiHealthJob): DSPDeliveryJob {
  if (!job.release) {
    throw new Error("Anghami worker requires a release payload on the queue job.");
  }
  const releaseId = resolveReleaseId(job);

  return {
    jobId: job.jobId ?? `${releaseId}:anghami`,
    releaseId,
    release: job.release,
    packageModel: job.packageModel ?? null,
    target: {
      connectorId: "Anghami",
      connectorVersion: "1.0.0",
      partnerName: "Anghami",
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
  dependencies: AnghamiWorkerDependencies,
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
    metadata: { connectorId: "Anghami" },
    ipAddress: null,
  });
}

export class AnghamiDeliveryWorker {
  constructor(private readonly dependencies: AnghamiWorkerDependencies) {}

  async process(job: AnghamiDeliveryJob): Promise<void> {
    const deliveryJob = buildDeliveryJob(job);
    const packageModel = await this.dependencies.enterpriseService.buildPackage(deliveryJob);
    const result = await this.dependencies.enterpriseService.deliver({ ...deliveryJob, packageModel });
    await recordAudit(this.dependencies, {
      aggregateId: deliveryJob.releaseId,
      action: result.success ? "ANGHAMI_MUSIC_DELIVERY_COMPLETED" : "ANGHAMI_MUSIC_DELIVERY_FAILED",
      actorUserId: job.actorUserId,
      correlationId: job.correlationId,
      reason: job.reason ?? null,
      metadata: this.dependencies.enterpriseService.generateDeliveryReport({ ...deliveryJob, packageModel }, result),
    });
  }
}

export class AnghamiPollingWorker {
  constructor(private readonly dependencies: AnghamiWorkerDependencies) {}

  async process(job: AnghamiPollingJob): Promise<void> {
    const deliveryJob = buildDeliveryJob(job);
    const packageModel = await this.dependencies.enterpriseService.buildPackage(deliveryJob);
    const status = await this.dependencies.enterpriseService.pollStatus({ ...deliveryJob, packageModel });
    await recordAudit(this.dependencies, {
      aggregateId: deliveryJob.releaseId,
      action: "ANGHAMI_MUSIC_STATUS_POLLED",
      actorUserId: job.actorUserId,
      correlationId: job.correlationId,
      reason: null,
      metadata: { status },
    });
  }
}

export class AnghamiRetryWorker {
  constructor(private readonly dependencies: AnghamiWorkerDependencies) {}

  async process(job: AnghamiRetryJob): Promise<void> {
    const deliveryJob = buildDeliveryJob(job);
    const packageModel = await this.dependencies.enterpriseService.buildPackage(deliveryJob);
    const retry = this.dependencies.enterpriseService.retry(new Error(job.reason ?? "Anghami retry requested"), 0, { ...deliveryJob, packageModel });
    await recordAudit(this.dependencies, {
      aggregateId: deliveryJob.releaseId,
      action: retry.retryCount > 0 ? "ANGHAMI_MUSIC_RETRY_SCHEDULED" : "ANGHAMI_MUSIC_RETRY_SKIPPED",
      actorUserId: job.actorUserId,
      correlationId: job.correlationId,
      reason: job.reason ?? null,
      metadata: retry,
    });
  }
}

export class AnghamiWebhookWorker {
  constructor(private readonly dependencies: AnghamiWorkerDependencies) {}

  async process(job: AnghamiWebhookJob): Promise<void> {
    const deliveryJob = buildDeliveryJob(job);
    const packageModel = await this.dependencies.enterpriseService.buildPackage(deliveryJob);
    const webhookResult = await this.dependencies.enterpriseService.handleWebhook({
      webhookId: `Anghami:${job.releaseId}:${job.eventType}`,
      connectorId: "Anghami",
      releaseId: job.releaseId,
      eventType: job.eventType,
      receivedAt: job.createdAt,
      headers: job.headers ?? {},
      payload: job.payload ?? {},
      signatureValid: job.signatureValid ?? false,
    });
    await recordAudit(this.dependencies, {
      aggregateId: deliveryJob.releaseId,
      action: job.signatureValid === false ? "ANGHAMI_MUSIC_WEBHOOK_REJECTED" : "ANGHAMI_MUSIC_WEBHOOK_PROCESSED",
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

export class AnghamiHealthWorker {
  constructor(private readonly dependencies: AnghamiWorkerDependencies) {}

  async process(job: AnghamiHealthJob): Promise<void> {
    const deliveryJob = buildDeliveryJob(job);
    const packageModel = await this.dependencies.enterpriseService.buildPackage(deliveryJob);
    const health = await this.dependencies.enterpriseService.healthCheck({ ...deliveryJob, packageModel });
    await recordAudit(this.dependencies, {
      aggregateId: deliveryJob.releaseId,
      action: "ANGHAMI_MUSIC_HEALTH_CHECKED",
      actorUserId: job.actorUserId,
      correlationId: job.correlationId,
      reason: job.reason ?? null,
      metadata: this.dependencies.enterpriseService.generateHealthReport("Anghami", health),
    });
  }
}

export function registerAnghamiDeliveryWorker(worker: AnghamiDeliveryWorker, options: { concurrency?: number } = {}): WorkerLike {
  return createWorker(queueNames.anghamiDelivery, async (job) => {
    await worker.process(job.data as AnghamiDeliveryJob);
  }, { concurrency: options.concurrency });
}

export function registerAnghamiPollingWorker(worker: AnghamiPollingWorker, options: { concurrency?: number } = {}): WorkerLike {
  return createWorker(queueNames.anghamiPolling, async (job) => {
    await worker.process(job.data as AnghamiPollingJob);
  }, { concurrency: options.concurrency });
}

export function registerAnghamiRetryWorker(worker: AnghamiRetryWorker, options: { concurrency?: number } = {}): WorkerLike {
  return createWorker(queueNames.anghamiRetry, async (job) => {
    await worker.process(job.data as AnghamiRetryJob);
  }, { concurrency: options.concurrency });
}

export function registerAnghamiWebhookWorker(worker: AnghamiWebhookWorker, options: { concurrency?: number } = {}): WorkerLike {
  return createWorker(queueNames.anghamiWebhook, async (job) => {
    await worker.process(job.data as AnghamiWebhookJob);
  }, { concurrency: options.concurrency });
}

export function registerAnghamiHealthWorker(worker: AnghamiHealthWorker, options: { concurrency?: number } = {}): WorkerLike {
  return createWorker(queueNames.anghamiHealth, async (job) => {
    await worker.process(job.data as AnghamiHealthJob);
  }, { concurrency: options.concurrency });
}

