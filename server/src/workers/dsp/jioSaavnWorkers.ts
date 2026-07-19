import { createWorker, type WorkerLike } from "../../queue/queueFactory";
import { queueNames } from "../../queue/queueNames";
import type { JioSaavnDeliveryJob, JioSaavnHealthJob, JioSaavnPollingJob, JioSaavnRetryJob, JioSaavnWebhookJob } from "../../queue/jobTypes";
import type { EnterpriseOperationsService } from "../../distribution/admin/enterpriseOperationsService";
import type { DSPDeliveryJob } from "../../distribution/connectors/framework";
import type { Release } from "../../distribution/domain";
import { JioSaavnEnterpriseService } from "../../distribution/connectors/framework/jioSaavnConnector";

export type JioSaavnWorkerDependencies = Readonly<{
  enterpriseService: JioSaavnEnterpriseService;
  enterpriseOperationsService: EnterpriseOperationsService;
}>;

function releaseMetadata(release: Release): Record<string, unknown> {
  return (release.metadata ?? {}) as Record<string, unknown>;
}

function resolveEndpoint(release: Release): string | null {
  const metadata = releaseMetadata(release);
  const candidates = [
    metadata.jioSaavnDeliveryEndpoint,
    metadata.jioSaavnMusicDeliveryEndpoint,
    metadata.jioSaavnMusicIngestionUrl,
    metadata.jioSaavnStatusEndpoint,
    metadata.jioSaavnHealthEndpoint,
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

function resolveReleaseId(job: JioSaavnDeliveryJob | JioSaavnPollingJob | JioSaavnRetryJob | JioSaavnWebhookJob | JioSaavnHealthJob): string {
  const explicit = typeof job.releaseId === "string" ? job.releaseId.trim() : "";
  if (explicit) return explicit;
  const releaseId = job.release?.id;
  return typeof releaseId === "string" ? releaseId : "";
}

function buildDeliveryJob(job: JioSaavnDeliveryJob | JioSaavnPollingJob | JioSaavnRetryJob | JioSaavnWebhookJob | JioSaavnHealthJob): DSPDeliveryJob {
  if (!job.release) {
    throw new Error("JioSaavn worker requires a release payload on the queue job.");
  }
  const releaseId = resolveReleaseId(job);

  return {
    jobId: job.jobId ?? `${releaseId}:jiosaavn`,
    releaseId,
    release: job.release,
    packageModel: job.packageModel ?? null,
    target: {
      connectorId: "JioSaavn",
      connectorVersion: "1.0.0",
      partnerName: "JioSaavn",
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
  dependencies: JioSaavnWorkerDependencies,
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
    metadata: { connectorId: "JioSaavn" },
    ipAddress: null,
  });
}

export class JioSaavnDeliveryWorker {
  constructor(private readonly dependencies: JioSaavnWorkerDependencies) {}

  async process(job: JioSaavnDeliveryJob): Promise<void> {
    const deliveryJob = buildDeliveryJob(job);
    const packageModel = await this.dependencies.enterpriseService.buildPackage(deliveryJob);
    const result = await this.dependencies.enterpriseService.deliver({ ...deliveryJob, packageModel });
    await recordAudit(this.dependencies, {
      aggregateId: deliveryJob.releaseId,
      action: result.success ? "JIOSAAVN_MUSIC_DELIVERY_COMPLETED" : "JIOSAAVN_MUSIC_DELIVERY_FAILED",
      actorUserId: job.actorUserId,
      correlationId: job.correlationId,
      reason: job.reason ?? null,
      metadata: this.dependencies.enterpriseService.generateDeliveryReport({ ...deliveryJob, packageModel }, result),
    });
  }
}

export class JioSaavnPollingWorker {
  constructor(private readonly dependencies: JioSaavnWorkerDependencies) {}

  async process(job: JioSaavnPollingJob): Promise<void> {
    const deliveryJob = buildDeliveryJob(job);
    const packageModel = await this.dependencies.enterpriseService.buildPackage(deliveryJob);
    const status = await this.dependencies.enterpriseService.pollStatus({ ...deliveryJob, packageModel });
    await recordAudit(this.dependencies, {
      aggregateId: deliveryJob.releaseId,
      action: "JIOSAAVN_MUSIC_STATUS_POLLED",
      actorUserId: job.actorUserId,
      correlationId: job.correlationId,
      reason: null,
      metadata: { status },
    });
  }
}

export class JioSaavnRetryWorker {
  constructor(private readonly dependencies: JioSaavnWorkerDependencies) {}

  async process(job: JioSaavnRetryJob): Promise<void> {
    const deliveryJob = buildDeliveryJob(job);
    const packageModel = await this.dependencies.enterpriseService.buildPackage(deliveryJob);
    const retry = this.dependencies.enterpriseService.retry(new Error(job.reason ?? "JioSaavn retry requested"), 0, { ...deliveryJob, packageModel });
    await recordAudit(this.dependencies, {
      aggregateId: deliveryJob.releaseId,
      action: retry.retryCount > 0 ? "JIOSAAVN_MUSIC_RETRY_SCHEDULED" : "JIOSAAVN_MUSIC_RETRY_SKIPPED",
      actorUserId: job.actorUserId,
      correlationId: job.correlationId,
      reason: job.reason ?? null,
      metadata: retry,
    });
  }
}

export class JioSaavnWebhookWorker {
  constructor(private readonly dependencies: JioSaavnWorkerDependencies) {}

  async process(job: JioSaavnWebhookJob): Promise<void> {
    const deliveryJob = buildDeliveryJob(job);
    const packageModel = await this.dependencies.enterpriseService.buildPackage(deliveryJob);
    const webhookResult = await this.dependencies.enterpriseService.handleWebhook({
      webhookId: `jiosaavn:${deliveryJob.releaseId}:${job.eventType}`,
      connectorId: "JioSaavn",
      releaseId: deliveryJob.releaseId,
      eventType: job.eventType,
      receivedAt: job.createdAt,
      headers: job.headers ?? {},
      payload: job.payload ?? {},
      signatureValid: job.signatureValid ?? false,
    });
    await recordAudit(this.dependencies, {
      aggregateId: deliveryJob.releaseId,
      action: job.signatureValid === false ? "JIOSAAVN_MUSIC_WEBHOOK_REJECTED" : "JIOSAAVN_MUSIC_WEBHOOK_PROCESSED",
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

export class JioSaavnHealthWorker {
  constructor(private readonly dependencies: JioSaavnWorkerDependencies) {}

  async process(job: JioSaavnHealthJob): Promise<void> {
    const deliveryJob = buildDeliveryJob(job);
    const packageModel = await this.dependencies.enterpriseService.buildPackage(deliveryJob);
    const health = await this.dependencies.enterpriseService.healthCheck({ ...deliveryJob, packageModel });
    await recordAudit(this.dependencies, {
      aggregateId: deliveryJob.releaseId,
      action: "JIOSAAVN_MUSIC_HEALTH_CHECKED",
      actorUserId: job.actorUserId,
      correlationId: job.correlationId,
      reason: job.reason ?? null,
      metadata: this.dependencies.enterpriseService.generateHealthReport("JioSaavn", health),
    });
  }
}

export function registerJioSaavnDeliveryWorker(worker: JioSaavnDeliveryWorker, options: { concurrency?: number } = {}): WorkerLike {
  return createWorker(queueNames.jioSaavnDelivery, async (job) => {
    await worker.process(job.data as JioSaavnDeliveryJob);
  }, { concurrency: options.concurrency });
}

export function registerJioSaavnPollingWorker(worker: JioSaavnPollingWorker, options: { concurrency?: number } = {}): WorkerLike {
  return createWorker(queueNames.jioSaavnPolling, async (job) => {
    await worker.process(job.data as JioSaavnPollingJob);
  }, { concurrency: options.concurrency });
}

export function registerJioSaavnRetryWorker(worker: JioSaavnRetryWorker, options: { concurrency?: number } = {}): WorkerLike {
  return createWorker(queueNames.jioSaavnRetry, async (job) => {
    await worker.process(job.data as JioSaavnRetryJob);
  }, { concurrency: options.concurrency });
}

export function registerJioSaavnWebhookWorker(worker: JioSaavnWebhookWorker, options: { concurrency?: number } = {}): WorkerLike {
  return createWorker(queueNames.jioSaavnWebhook, async (job) => {
    await worker.process(job.data as JioSaavnWebhookJob);
  }, { concurrency: options.concurrency });
}

export function registerJioSaavnHealthWorker(worker: JioSaavnHealthWorker, options: { concurrency?: number } = {}): WorkerLike {
  return createWorker(queueNames.jioSaavnHealth, async (job) => {
    await worker.process(job.data as JioSaavnHealthJob);
  }, { concurrency: options.concurrency });
}
