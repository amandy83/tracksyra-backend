import { createWorker, type WorkerLike } from "../../queue/queueFactory";
import { queueNames } from "../../queue/queueNames";
import type { SpotifyDeliveryJob, SpotifyHealthJob, SpotifyPollingJob, SpotifyRetryJob, SpotifyWebhookJob } from "../../queue/jobTypes";
import type { EnterpriseOperationsService } from "../../distribution/admin/enterpriseOperationsService";
import type { DSPDeliveryJob } from "../../distribution/connectors/framework";
import type { ReleaseDeliveryEngine } from "../../distribution/core/releaseDeliveryEngine";
import type { Release } from "../../distribution/domain";

export type SpotifyWorkerDependencies = Readonly<{
  releaseDeliveryEngine: ReleaseDeliveryEngine;
  enterpriseOperationsService: EnterpriseOperationsService;
}>;

export class SpotifyDeliveryWorker {
  constructor(private readonly dependencies: SpotifyWorkerDependencies) {}

  async process(job: SpotifyDeliveryJob): Promise<void> {
    const deliveryJob = this.buildDeliveryJob(job);
    const validation = this.dependencies.releaseDeliveryEngine.validateConnectorRelease(deliveryJob);
    if (!validation.valid) {
      await this.dependencies.enterpriseOperationsService.recordSpotifyDeliveryOutcome({
        releaseId: job.releaseId,
        actor: job.actorUserId ?? "system",
        correlationId: job.correlationId ?? null,
        reason: job.reason ?? "Spotify release validation failed",
        success: false,
        connectorStatus: "VALIDATION_FAILED",
        receipt: null,
        errors: validation.errors.map((entry) => entry.message),
        warnings: validation.warnings.map((entry) => entry.message),
        metadata: { validation },
        ipAddress: null,
      });
      throw new Error(`Spotify validation failed: ${validation.errors.map((entry) => entry.message).join("; ")}`);
    }

    const result = await this.dependencies.releaseDeliveryEngine.deliverConnector(deliveryJob);
    await this.dependencies.enterpriseOperationsService.recordSpotifyDeliveryOutcome({
      releaseId: job.releaseId,
      actor: job.actorUserId ?? "system",
      correlationId: job.correlationId ?? null,
      reason: job.reason ?? null,
      success: result.success,
      connectorStatus: result.connectorStatus,
      receipt: result.receipt,
      errors: result.errors,
      warnings: result.warnings,
      metadata: result.metadata,
      ipAddress: null,
    });
  }

  private buildDeliveryJob(job: SpotifyDeliveryJob): DSPDeliveryJob {
    const release = this.requireRelease(job);
    return this.dependencies.releaseDeliveryEngine.buildConnectorDeliveryJob(release, {
      connectorId: "Spotify",
      partnerName: "Spotify",
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

  private requireRelease(job: SpotifyDeliveryJob): Release {
    if (!job.release) {
      throw new Error("Spotify delivery worker requires a release payload on the queue job.");
    }
    return job.release;
  }

  private resolveEndpoint(release: Release): string | null {
    const metadata = release.metadata as Record<string, unknown>;
    const candidates = [
      metadata.spotifyDeliveryEndpoint,
      metadata.spotifyIngestionUrl,
      metadata.dspDeliveryEndpoint,
      metadata.deliveryEndpointUrl,
    ];
    for (const candidate of candidates) {
      if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
    }
    return null;
  }
}

export class SpotifyPollingWorker {
  constructor(private readonly dependencies: SpotifyWorkerDependencies) {}

  async process(job: SpotifyPollingJob): Promise<void> {
    const deliveryJob = this.buildDeliveryJob(job);
    const status = await this.dependencies.releaseDeliveryEngine.pollConnectorStatus(deliveryJob);
    await this.record(job, "SPOTIFY_STATUS_POLLED", {
      providerStatus: status.providerStatus,
      status: status.status,
      observedAt: status.observedAt,
    });
  }

  private buildDeliveryJob(job: SpotifyPollingJob): DSPDeliveryJob {
    const release = this.requireRelease(job);
    return this.dependencies.releaseDeliveryEngine.buildConnectorDeliveryJob(release, {
      connectorId: "Spotify",
      partnerName: "Spotify",
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

  private async record(job: SpotifyPollingJob, action: string, metadata: Record<string, unknown>) {
    await this.dependencies.enterpriseOperationsService.recordAuditEvent({
      aggregateType: "delivery_queue",
      aggregateId: job.releaseId,
      action,
      actor: job.actorUserId ?? "system",
      reason: null,
      correlationId: job.correlationId ?? null,
      oldValue: null,
      newValue: metadata,
      metadata: { connectorId: "Spotify" },
      ipAddress: null,
    });
  }

  private requireRelease(job: SpotifyPollingJob): Release {
    if (!job.release) {
      throw new Error("Spotify polling worker requires a release payload on the queue job.");
    }
    return job.release;
  }

  private resolveEndpoint(release: Release): string | null {
    const metadata = release.metadata as Record<string, unknown>;
    const candidates = [
      metadata.spotifyStatusEndpoint,
      metadata.spotifyDeliveryEndpoint,
      metadata.spotifyIngestionUrl,
      metadata.dspStatusEndpoint,
    ];
    for (const candidate of candidates) {
      if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
    }
    return null;
  }
}

export class SpotifyRetryWorker {
  constructor(private readonly dependencies: SpotifyWorkerDependencies) {}

  async process(job: SpotifyRetryJob): Promise<void> {
    const deliveryJob = this.buildDeliveryJob(job);
    const retryDecision = await this.dependencies.releaseDeliveryEngine.retryConnector(deliveryJob, 0, job.reason ?? null);
    await this.dependencies.enterpriseOperationsService.recordAuditEvent({
      aggregateType: "delivery_queue",
      aggregateId: job.releaseId,
      action: retryDecision.nextAttemptAt ? "SPOTIFY_RETRY_SCHEDULED" : "SPOTIFY_RETRY_SKIPPED",
      actor: job.actorUserId ?? "system",
      reason: job.reason ?? null,
      correlationId: job.correlationId ?? null,
      oldValue: null,
      newValue: retryDecision,
      metadata: { connectorId: "Spotify", deliveryQueueId: job.deliveryQueueId ?? null },
      ipAddress: null,
    });
  }

  private buildDeliveryJob(job: SpotifyRetryJob): DSPDeliveryJob {
    const release = this.requireRelease(job);
    return this.dependencies.releaseDeliveryEngine.buildConnectorDeliveryJob(release, {
      connectorId: "Spotify",
      partnerName: "Spotify",
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

  private requireRelease(job: SpotifyRetryJob): Release {
    if (!job.release) {
      throw new Error("Spotify retry worker requires a release payload on the queue job.");
    }
    return job.release;
  }

  private resolveEndpoint(release: Release): string | null {
    const metadata = release.metadata as Record<string, unknown>;
    const candidates = [
      metadata.spotifyDeliveryEndpoint,
      metadata.spotifyIngestionUrl,
      metadata.dspDeliveryEndpoint,
      metadata.deliveryEndpointUrl,
    ];
    for (const candidate of candidates) {
      if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
    }
    return null;
  }
}

export class SpotifyHealthWorker {
  constructor(private readonly dependencies: SpotifyWorkerDependencies) {}

  async process(job: SpotifyHealthJob): Promise<void> {
    const deliveryJob = this.buildDeliveryJob(job);
    const health = await this.dependencies.releaseDeliveryEngine.healthCheckConnector(deliveryJob);
    await this.dependencies.enterpriseOperationsService.recordAuditEvent({
      aggregateType: "delivery_queue",
      aggregateId: deliveryJob.releaseId,
      action: "SPOTIFY_HEALTH_CHECKED",
      actor: job.actorUserId ?? "system",
      reason: job.reason ?? null,
      correlationId: job.correlationId ?? null,
      oldValue: null,
      newValue: health,
      metadata: { connectorId: "Spotify" },
      ipAddress: null,
    });
  }

  private buildDeliveryJob(job: SpotifyHealthJob): DSPDeliveryJob {
    const release = this.requireRelease(job);
    return this.dependencies.releaseDeliveryEngine.buildConnectorDeliveryJob(release, {
      connectorId: "Spotify",
      partnerName: "Spotify",
      endpointUrl: this.resolveEndpoint(release),
      territories: release.territories.values.length ? release.territories.values : ["WORLD"],
      metadata: {
        actorUserId: job.actorUserId,
        correlationId: job.correlationId,
        sourceSystem: job.sourceSystem,
      },
      connectorVersion: job.connectorId ?? "1.0.0",
    });
  }

  private requireRelease(job: SpotifyHealthJob): Release {
    if (!job.release) {
      throw new Error("Spotify health worker requires a release payload on the queue job.");
    }
    return job.release;
  }

  private resolveEndpoint(release: Release): string | null {
    const metadata = release.metadata as Record<string, unknown>;
    const candidates = [
      metadata.spotifyHealthEndpoint,
      metadata.spotifyDeliveryEndpoint,
      metadata.spotifyIngestionUrl,
      metadata.dspHealthEndpoint,
    ];
    for (const candidate of candidates) {
      if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
    }
    return null;
  }
}

export class SpotifyWebhookWorker {
  constructor(private readonly dependencies: SpotifyWorkerDependencies) {}

  async process(job: SpotifyWebhookJob): Promise<void> {
    const deliveryJob = this.buildDeliveryJob(job);
    const result = await this.dependencies.releaseDeliveryEngine.pollConnectorStatus(deliveryJob);
    await this.dependencies.enterpriseOperationsService.recordAuditEvent({
      aggregateType: "delivery_queue",
      aggregateId: job.releaseId,
      action: job.signatureValid === false ? "SPOTIFY_WEBHOOK_REJECTED" : "SPOTIFY_WEBHOOK_PROCESSED",
      actor: job.actorUserId ?? "system",
      reason: job.source ?? null,
      correlationId: job.correlationId ?? null,
      oldValue: null,
      newValue: {
        connectorId: "Spotify",
        eventType: job.eventType,
        signatureValid: job.signatureValid ?? false,
        providerStatus: result.providerStatus,
        status: result.status,
        payload: job.payload ?? {},
      },
      metadata: { connectorId: "Spotify", headers: job.headers ?? {} },
      ipAddress: null,
    });
  }

  private buildDeliveryJob(job: SpotifyWebhookJob): DSPDeliveryJob {
    const release = this.requireRelease(job);
    return this.dependencies.releaseDeliveryEngine.buildConnectorDeliveryJob(release, {
      connectorId: "Spotify",
      partnerName: "Spotify",
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

  private requireRelease(job: SpotifyWebhookJob): Release {
    if (!job.release) {
      throw new Error("Spotify webhook worker requires a release payload on the queue job.");
    }
    return job.release;
  }

  private resolveEndpoint(release: Release): string | null {
    const metadata = release.metadata as Record<string, unknown>;
    const candidates = [
      metadata.spotifyDeliveryEndpoint,
      metadata.spotifyIngestionUrl,
      metadata.dspDeliveryEndpoint,
      metadata.deliveryEndpointUrl,
    ];
    for (const candidate of candidates) {
      if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
    }
    return null;
  }
}

export function registerSpotifyDeliveryWorker(worker: SpotifyDeliveryWorker, options: { concurrency?: number } = {}): WorkerLike {
  return createWorker(queueNames.spotifyDelivery, async (job) => {
    await worker.process(job.data as SpotifyDeliveryJob);
  }, { concurrency: options.concurrency });
}

export function registerSpotifyPollingWorker(worker: SpotifyPollingWorker, options: { concurrency?: number } = {}): WorkerLike {
  return createWorker(queueNames.spotifyPolling, async (job) => {
    await worker.process(job.data as SpotifyPollingJob);
  }, { concurrency: options.concurrency });
}

export function registerSpotifyRetryWorker(worker: SpotifyRetryWorker, options: { concurrency?: number } = {}): WorkerLike {
  return createWorker(queueNames.spotifyRetry, async (job) => {
    await worker.process(job.data as SpotifyRetryJob);
  }, { concurrency: options.concurrency });
}

export function registerSpotifyHealthWorker(worker: SpotifyHealthWorker, options: { concurrency?: number } = {}): WorkerLike {
  return createWorker(queueNames.spotifyHealth, async (job) => {
    await worker.process(job.data as SpotifyHealthJob);
  }, { concurrency: options.concurrency });
}

export function registerSpotifyWebhookWorker(worker: SpotifyWebhookWorker, options: { concurrency?: number } = {}): WorkerLike {
  return createWorker(queueNames.spotifyWebhook, async (job) => {
    await worker.process(job.data as SpotifyWebhookJob);
  }, { concurrency: options.concurrency });
}
