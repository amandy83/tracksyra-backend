import { createWorker, type WorkerLike } from "../../queue/queueFactory";
import { queueNames } from "../../queue/queueNames";
import type {
  MetadataAuditJob,
  MetadataNormalizationJob,
  MetadataRecommendationJob,
  MetadataRepairJob,
  MetadataRetryJob,
  MetadataValidationJob,
} from "../../queue/jobTypes";
import type { EnterpriseOperationsService } from "../../distribution/admin/enterpriseOperationsService";
import { MetadataIntelligenceEngine } from "../../distribution/intelligence/metadata";
import { incrementMetric, recordRetry, setWorkerHealth } from "../../queue/metrics";

type MetadataWorkerDeps = Readonly<{
  engine: MetadataIntelligenceEngine;
  operations?: EnterpriseOperationsService | null;
}>;

function toInput(job: MetadataValidationJob | MetadataNormalizationJob | MetadataRepairJob | MetadataRecommendationJob | MetadataRetryJob | MetadataAuditJob) {
  const release = job.release;
  if (!release) {
    throw new Error("Metadata worker requires a release payload on the queue job.");
  }
  return {
    releaseId: job.releaseId ?? "",
    trackId: job.trackId ?? null,
    actor: job.actorUserId ?? "worker",
    correlationId: job.correlationId ?? null,
    metadata: job.metadata ?? {},
    release,
    track: "track" in job ? job.track ?? null : null,
  };
}

async function recordOutcome(
  deps: MetadataWorkerDeps,
  aggregateId: string,
  action: string,
  metadata: Readonly<Record<string, unknown>>,
) {
  if (!deps.operations) return;
  await deps.operations.recordAuditEvent({
    aggregateType: "metadata_intelligence",
    aggregateId,
    action,
    actor: "worker",
    reason: null,
    correlationId: null,
    oldValue: null,
    newValue: metadata,
    metadata,
    ipAddress: null,
  });
}

export class MetadataValidationWorker {
  constructor(private readonly deps: MetadataWorkerDeps) {}

  async process(job: MetadataValidationJob) {
    const result = await this.deps.engine.validateMetadata(toInput(job));
    await recordOutcome(this.deps, job.releaseId, "METADATA_VALIDATED", {
      releaseId: job.releaseId,
      trackId: job.trackId ?? null,
      valid: result.valid,
      conflictCount: result.conflicts.length,
      repairCount: result.repairs.length,
    });
    incrementMetric("tracksyra_metadata_validation_worker_completed_total", { queue: queueNames.metadataValidation });
    return result;
  }
}

export class MetadataNormalizationWorker {
  constructor(private readonly deps: MetadataWorkerDeps) {}

  async process(job: MetadataNormalizationJob) {
    const result = await this.deps.engine.normalizeMetadata(toInput(job));
    await recordOutcome(this.deps, job.releaseId, "METADATA_NORMALIZED", {
      releaseId: job.releaseId,
      trackId: job.trackId ?? null,
      overallReleaseScore: result.quality.overallReleaseScore,
    });
    incrementMetric("tracksyra_metadata_normalization_worker_completed_total", { queue: queueNames.metadataNormalization });
    return result;
  }
}

export class MetadataRepairWorker {
  constructor(private readonly deps: MetadataWorkerDeps) {}

  async process(job: MetadataRepairJob) {
    const result = await this.deps.engine.repairMetadata(toInput(job));
    await recordOutcome(this.deps, job.releaseId, "METADATA_REPAIRED", {
      releaseId: result.release.id,
      trackId: result.track?.id ?? null,
      repairs: result.repairs.length,
    });
    incrementMetric("tracksyra_metadata_repair_worker_completed_total", { queue: queueNames.metadataRepair });
    return result;
  }
}

export class MetadataRecommendationWorker {
  constructor(private readonly deps: MetadataWorkerDeps) {}

  async process(job: MetadataRecommendationJob) {
    const result = await this.deps.engine.recommendMetadata(toInput(job));
    await recordOutcome(this.deps, job.releaseId, "METADATA_RECOMMENDATIONS_GENERATED", {
      releaseId: job.releaseId,
      trackId: job.trackId ?? null,
      recommendationCount: result.length,
    });
    incrementMetric("tracksyra_metadata_recommendation_worker_completed_total", { queue: queueNames.metadataRecommendation });
    return result;
  }
}

export class MetadataAuditWorker {
  constructor(private readonly deps: MetadataWorkerDeps) {}

  async process(job: MetadataAuditJob) {
    const result = await this.deps.engine.generateDashboard({
      releaseId: job.releaseId ?? "",
      trackId: job.trackId ?? null,
      actor: job.actorUserId ?? "worker",
      correlationId: job.correlationId ?? null,
      metadata: job.metadata ?? {},
      kind: job.reportKind ?? "metadata",
    });
    setWorkerHealth(queueNames.metadataAudit, "healthy");
    incrementMetric("tracksyra_metadata_audit_worker_completed_total", { queue: queueNames.metadataAudit });
    return result;
  }
}

export class MetadataRetryWorker {
  constructor(private readonly deps: MetadataWorkerDeps) {}

  async process(job: MetadataRetryJob) {
    recordRetry(queueNames.metadataRetry);
    const result = await this.deps.engine.retry({
      ...toInput(job),
      attempt: job.attempt ?? 1,
      error: job.error ?? null,
    });
    await recordOutcome(this.deps, job.releaseId, "METADATA_RETRY_PROCESSED", {
      releaseId: job.releaseId,
      trackId: job.trackId ?? null,
      attempt: job.attempt ?? 1,
    });
    incrementMetric("tracksyra_metadata_retry_worker_completed_total", { queue: queueNames.metadataRetry });
    return result;
  }
}

export function registerMetadataValidationWorker(deps: MetadataWorkerDeps, options: { concurrency?: number } = {}): WorkerLike {
  return createWorker(queueNames.metadataValidation, async (job) => new MetadataValidationWorker(deps).process(job.data as MetadataValidationJob), { concurrency: options.concurrency });
}

export function registerMetadataNormalizationWorker(deps: MetadataWorkerDeps, options: { concurrency?: number } = {}): WorkerLike {
  return createWorker(queueNames.metadataNormalization, async (job) => new MetadataNormalizationWorker(deps).process(job.data as MetadataNormalizationJob), { concurrency: options.concurrency });
}

export function registerMetadataRepairWorker(deps: MetadataWorkerDeps, options: { concurrency?: number } = {}): WorkerLike {
  return createWorker(queueNames.metadataRepair, async (job) => new MetadataRepairWorker(deps).process(job.data as MetadataRepairJob), { concurrency: options.concurrency });
}

export function registerMetadataRecommendationWorker(deps: MetadataWorkerDeps, options: { concurrency?: number } = {}): WorkerLike {
  return createWorker(queueNames.metadataRecommendation, async (job) => new MetadataRecommendationWorker(deps).process(job.data as MetadataRecommendationJob), { concurrency: options.concurrency });
}

export function registerMetadataAuditWorker(deps: MetadataWorkerDeps, options: { concurrency?: number } = {}): WorkerLike {
  return createWorker(queueNames.metadataAudit, async (job) => new MetadataAuditWorker(deps).process(job.data as MetadataAuditJob), { concurrency: options.concurrency });
}

export function registerMetadataRetryWorker(deps: MetadataWorkerDeps, options: { concurrency?: number } = {}): WorkerLike {
  return createWorker(queueNames.metadataRetry, async (job) => new MetadataRetryWorker(deps).process(job.data as MetadataRetryJob), { concurrency: options.concurrency });
}
