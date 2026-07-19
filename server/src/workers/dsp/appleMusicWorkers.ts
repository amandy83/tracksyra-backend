import { createWorker, type WorkerLike } from "../../queue/queueFactory";
import { queueNames } from "../../queue/queueNames";
import type { AppleMusicDeliveryJob, AppleMusicHealthJob, AppleMusicPollingJob, AppleMusicRetryJob, AppleMusicWebhookJob } from "../../queue/jobTypes";
import type { EnterpriseOperationsService } from "../../distribution/admin/enterpriseOperationsService";
import type { DSPDeliveryJob } from "../../distribution/connectors/framework";
import type { ReleaseDeliveryEngine } from "../../distribution/core/releaseDeliveryEngine";
import type { Release } from "../../distribution/domain";

export type AppleMusicWorkerDependencies = Readonly<{
  releaseDeliveryEngine: ReleaseDeliveryEngine;
  enterpriseOperationsService: EnterpriseOperationsService;
}>;

export class AppleMusicDeliveryWorker {
  constructor(private readonly dependencies: AppleMusicWorkerDependencies) {}

  async process(job: AppleMusicDeliveryJob): Promise<void> {
    const deliveryJob = this.buildDeliveryJob(job);
    const validation = this.dependencies.releaseDeliveryEngine.validateConnectorRelease(deliveryJob);
    if (!validation.valid) {
      await this.dependencies.enterpriseOperationsService.recordAuditEvent({
        aggregateType: "delivery_queue",
        aggregateId: job.releaseId,
        action: "APPLE_MUSIC_VALIDATION_FAILED",
        actor: job.actorUserId ?? "system",
        reason: job.reason ?? "Apple Music release validation failed",
        correlationId: job.correlationId ?? null,
        oldValue: null,
        newValue: { validation },
        metadata: { connectorId: "AppleMusic" },
        ipAddress: null,
      });
      throw new Error(`Apple Music validation failed: ${validation.errors.map((entry) => entry.message).join("; ")}`);
    }

    const result = await this.dependencies.releaseDeliveryEngine.deliverConnector(deliveryJob);
    await this.dependencies.enterpriseOperationsService.recordAuditEvent({
      aggregateType: "delivery_queue",
      aggregateId: job.releaseId,
      action: result.success ? "APPLE_MUSIC_DELIVERY_COMPLETED" : "APPLE_MUSIC_DELIVERY_FAILED",
      actor: job.actorUserId ?? "system",
      reason: job.reason ?? null,
      correlationId: job.correlationId ?? null,
      oldValue: null,
      newValue: result,
      metadata: { connectorId: "AppleMusic" },
      ipAddress: null,
    });
  }

  private buildDeliveryJob(job: AppleMusicDeliveryJob): DSPDeliveryJob {
    const release = this.requireRelease(job);
    return this.dependencies.releaseDeliveryEngine.buildConnectorDeliveryJob(release, {
      connectorId: "AppleMusic",
      partnerName: "AppleMusic",
      endpointUrl: this.resolveEndpoint(release),
      territories: release.territories.values.length ? release.territories.values : ["WORLD"],
      metadata: {
        actorUserId: job.actorUserId,
        correlationId: job.correlationId,
        sourceSystem: job.sourceSystem,
        reason: job.reason ?? null,
      },
      connectorVersion: release.version?.value ?? "1.0.0",
    }, {
      requestedBy: job.actorUserId ?? null,
      scheduledFor: null,
      metadata: {
        sourceSystem: job.sourceSystem,
        reason: job.reason ?? null,
      },
    });
  }

  private requireRelease(job: AppleMusicDeliveryJob): Release {
    if (!job.release) {
      throw new Error("Apple Music delivery worker requires a release payload on the queue job.");
    }
    return job.release;
  }

  private resolveEndpoint(release: Release): string | null {
    const metadata = release.metadata as Record<string, unknown>;
    const candidates = [
      metadata.appleMusicDeliveryEndpoint,
      metadata.appleMusicIngestionUrl,
      metadata.dspDeliveryEndpoint,
      metadata.deliveryEndpointUrl,
    ];
    for (const candidate of candidates) {
      if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
    }
    return null;
  }
}

export class AppleMusicPollingWorker {
  constructor(private readonly dependencies: AppleMusicWorkerDependencies) {}

  async process(job: AppleMusicPollingJob): Promise<void> {
    const deliveryJob = this.buildDeliveryJob(job);
    const status = await this.dependencies.releaseDeliveryEngine.pollConnectorStatus(deliveryJob);
    await this.record(job, "APPLE_MUSIC_STATUS_POLLED", {
      providerStatus: status.providerStatus,
      status: status.status,
      observedAt: status.observedAt,
    });
  }

  private buildDeliveryJob(job: AppleMusicPollingJob): DSPDeliveryJob {
    const release = this.requireRelease(job);
    return this.dependencies.releaseDeliveryEngine.buildConnectorDeliveryJob(release, {
      connectorId: "AppleMusic",
      partnerName: "AppleMusic",
      endpointUrl: this.resolveEndpoint(release),
      territories: release.territories.values.length ? release.territories.values : ["WORLD"],
      metadata: {
        actorUserId: job.actorUserId,
        correlationId: job.correlationId,
        sourceSystem: job.sourceSystem,
      },
      connectorVersion: release.version?.value ?? "1.0.0",
    });
  }

  private async record(job: AppleMusicPollingJob, action: string, metadata: Record<string, unknown>) {
    await this.dependencies.enterpriseOperationsService.recordAuditEvent({
      aggregateType: "delivery_queue",
      aggregateId: job.releaseId,
      action,
      actor: job.actorUserId ?? "system",
      reason: null,
      correlationId: job.correlationId ?? null,
      oldValue: null,
      newValue: metadata,
      metadata: { connectorId: "AppleMusic" },
      ipAddress: null,
    });
  }

  private requireRelease(job: AppleMusicPollingJob): Release {
    if (!job.release) {
      throw new Error("Apple Music polling worker requires a release payload on the queue job.");
    }
    return job.release;
  }

  private resolveEndpoint(release: Release): string | null {
    const metadata = release.metadata as Record<string, unknown>;
    const candidates = [
      metadata.appleMusicStatusEndpoint,
      metadata.appleMusicDeliveryEndpoint,
      metadata.appleMusicIngestionUrl,
      metadata.dspStatusEndpoint,
    ];
    for (const candidate of candidates) {
      if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
    }
    return null;
  }
}

export class AppleMusicRetryWorker {
  constructor(private readonly dependencies: AppleMusicWorkerDependencies) {}

  async process(job: AppleMusicRetryJob): Promise<void> {
    const deliveryJob = this.buildDeliveryJob(job);
    const retryDecision = await this.dependencies.releaseDeliveryEngine.retryConnector(deliveryJob, 0, job.reason ?? null);
    await this.dependencies.enterpriseOperationsService.recordAuditEvent({
      aggregateType: "delivery_queue",
      aggregateId: job.releaseId,
      action: retryDecision.nextAttemptAt ? "APPLE_MUSIC_RETRY_SCHEDULED" : "APPLE_MUSIC_RETRY_SKIPPED",
      actor: job.actorUserId ?? "system",
      reason: job.reason ?? null,
      correlationId: job.correlationId ?? null,
      oldValue: null,
      newValue: retryDecision,
      metadata: { connectorId: "AppleMusic", deliveryQueueId: job.deliveryQueueId ?? null },
      ipAddress: null,
    });
  }

  private buildDeliveryJob(job: AppleMusicRetryJob): DSPDeliveryJob {
    const release = this.requireRelease(job);
    return this.dependencies.releaseDeliveryEngine.buildConnectorDeliveryJob(release, {
      connectorId: "AppleMusic",
      partnerName: "AppleMusic",
      endpointUrl: this.resolveEndpoint(release),
      territories: release.territories.values.length ? release.territories.values : ["WORLD"],
      metadata: {
        actorUserId: job.actorUserId,
        correlationId: job.correlationId,
        sourceSystem: job.sourceSystem,
      },
      connectorVersion: release.version?.value ?? "1.0.0",
    });
  }

  private requireRelease(job: AppleMusicRetryJob): Release {
    if (!job.release) {
      throw new Error("Apple Music retry worker requires a release payload on the queue job.");
    }
    return job.release;
  }

  private resolveEndpoint(release: Release): string | null {
    const metadata = release.metadata as Record<string, unknown>;
    const candidates = [
      metadata.appleMusicDeliveryEndpoint,
      metadata.appleMusicIngestionUrl,
      metadata.dspDeliveryEndpoint,
      metadata.deliveryEndpointUrl,
    ];
    for (const candidate of candidates) {
      if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
    }
    return null;
  }
}

export class AppleMusicWebhookWorker {
  constructor(private readonly dependencies: AppleMusicWorkerDependencies) {}

  async process(job: AppleMusicWebhookJob): Promise<void> {
    const deliveryJob = this.buildDeliveryJob(job);
    const status = await this.dependencies.releaseDeliveryEngine.pollConnectorStatus(deliveryJob);
    await this.dependencies.enterpriseOperationsService.recordAuditEvent({
      aggregateType: "delivery_queue",
      aggregateId: job.releaseId,
      action: job.signatureValid === false ? "APPLE_MUSIC_WEBHOOK_REJECTED" : "APPLE_MUSIC_WEBHOOK_PROCESSED",
      actor: job.actorUserId ?? "system",
      reason: job.source ?? null,
      correlationId: job.correlationId ?? null,
      oldValue: null,
      newValue: {
        connectorId: "AppleMusic",
        eventType: job.eventType,
        signatureValid: job.signatureValid ?? false,
        providerStatus: status.providerStatus,
        status: status.status,
        payload: job.payload ?? {},
      },
      metadata: { connectorId: "AppleMusic", headers: job.headers ?? {} },
      ipAddress: null,
    });
  }

  private buildDeliveryJob(job: AppleMusicWebhookJob): DSPDeliveryJob {
    const release = this.requireRelease(job);
    return this.dependencies.releaseDeliveryEngine.buildConnectorDeliveryJob(release, {
      connectorId: "AppleMusic",
      partnerName: "AppleMusic",
      endpointUrl: this.resolveEndpoint(release),
      territories: release.territories.values.length ? release.territories.values : ["WORLD"],
      metadata: {
        actorUserId: job.actorUserId,
        correlationId: job.correlationId,
        sourceSystem: job.sourceSystem,
        eventType: job.eventType,
      },
      connectorVersion: release.version?.value ?? "1.0.0",
    });
  }

  private requireRelease(job: AppleMusicWebhookJob): Release {
    if (!job.release) {
      throw new Error("Apple Music webhook worker requires a release payload on the queue job.");
    }
    return job.release;
  }

  private resolveEndpoint(release: Release): string | null {
    const metadata = release.metadata as Record<string, unknown>;
    const candidates = [
      metadata.appleMusicDeliveryEndpoint,
      metadata.appleMusicIngestionUrl,
      metadata.dspDeliveryEndpoint,
      metadata.deliveryEndpointUrl,
    ];
    for (const candidate of candidates) {
      if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
    }
    return null;
  }
}

export class AppleMusicHealthWorker {
  constructor(private readonly dependencies: AppleMusicWorkerDependencies) {}

  async process(job: AppleMusicHealthJob): Promise<void> {
    const release = this.requireRelease(job);
    const deliveryJob = this.dependencies.releaseDeliveryEngine.buildConnectorDeliveryJob(release, {
      connectorId: "AppleMusic",
      partnerName: "AppleMusic",
      endpointUrl: this.resolveEndpoint(release),
      territories: release.territories.values.length ? release.territories.values : ["WORLD"],
      metadata: {
        actorUserId: job.actorUserId,
        correlationId: job.correlationId,
        sourceSystem: job.sourceSystem,
      },
      connectorVersion: job.connectorId ?? "1.0.0",
    });
    const health = await this.dependencies.releaseDeliveryEngine.healthCheckConnector(deliveryJob);
    await this.dependencies.enterpriseOperationsService.recordAuditEvent({
      aggregateType: "delivery_queue",
      aggregateId: deliveryJob.releaseId,
      action: "APPLE_MUSIC_HEALTH_CHECKED",
      actor: job.actorUserId ?? "system",
      reason: job.reason ?? null,
      correlationId: job.correlationId ?? null,
      oldValue: null,
      newValue: health,
      metadata: { connectorId: "AppleMusic" },
      ipAddress: null,
    });
  }

  private requireRelease(job: AppleMusicHealthJob): Release {
    if (!job.release) {
      throw new Error("Apple Music health worker requires a release payload on the queue job.");
    }
    return job.release;
  }

  private resolveEndpoint(release: Release): string | null {
    const metadata = release.metadata as Record<string, unknown>;
    const candidates = [
      metadata.appleMusicHealthEndpoint,
      metadata.appleMusicDeliveryEndpoint,
      metadata.appleMusicIngestionUrl,
      metadata.dspHealthEndpoint,
    ];
    for (const candidate of candidates) {
      if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
    }
    return null;
  }
}

export function registerAppleMusicDeliveryWorker(worker: AppleMusicDeliveryWorker, options: { concurrency?: number } = {}): WorkerLike {
  return createWorker(queueNames.appleMusicDelivery, async (job) => {
    await worker.process(job.data as AppleMusicDeliveryJob);
  }, { concurrency: options.concurrency });
}

export function registerAppleMusicPollingWorker(worker: AppleMusicPollingWorker, options: { concurrency?: number } = {}): WorkerLike {
  return createWorker(queueNames.appleMusicPolling, async (job) => {
    await worker.process(job.data as AppleMusicPollingJob);
  }, { concurrency: options.concurrency });
}

export function registerAppleMusicRetryWorker(worker: AppleMusicRetryWorker, options: { concurrency?: number } = {}): WorkerLike {
  return createWorker(queueNames.appleMusicRetry, async (job) => {
    await worker.process(job.data as AppleMusicRetryJob);
  }, { concurrency: options.concurrency });
}

export function registerAppleMusicWebhookWorker(worker: AppleMusicWebhookWorker, options: { concurrency?: number } = {}): WorkerLike {
  return createWorker(queueNames.appleMusicWebhook, async (job) => {
    await worker.process(job.data as AppleMusicWebhookJob);
  }, { concurrency: options.concurrency });
}

export function registerAppleMusicHealthWorker(worker: AppleMusicHealthWorker, options: { concurrency?: number } = {}): WorkerLike {
  return createWorker(queueNames.appleMusicHealth, async (job) => {
    await worker.process(job.data as AppleMusicHealthJob);
  }, { concurrency: options.concurrency });
}
