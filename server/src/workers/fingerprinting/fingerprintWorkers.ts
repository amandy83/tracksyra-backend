import { createWorker } from "../../queue/queueFactory";
import { queueNames } from "../../queue/queueNames";
import type {
  AudioFraudJob,
  DuplicateDetectionJob,
  FingerprintAuditJob,
  FingerprintJob,
  FingerprintRetryJob,
  SimilarityJob,
} from "../../queue/jobTypes";
import { AudioFingerprintingEngine } from "../../distribution/intelligence/fingerprinting";
import type { EnterpriseOperationsService } from "../../distribution/admin/enterpriseOperationsService";
import { incrementMetric, recordRetry, setWorkerHealth } from "../../queue/metrics";

type FingerprintWorkerDeps = Readonly<{
  engine: AudioFingerprintingEngine;
  operations?: EnterpriseOperationsService | null;
}>;

function toInput(job: FingerprintJob | DuplicateDetectionJob | SimilarityJob | AudioFraudJob | FingerprintRetryJob | FingerprintAuditJob) {
  const data = job as Partial<{
    releaseId: string;
    trackId: string | null;
    assetId: string | null;
    sourceUrl: string | null;
    release: FingerprintJob["release"];
    track: FingerprintJob["track"];
    sampleRateHz: number | null;
    pcmBuffer: Buffer | null;
    metadata: Readonly<Record<string, unknown>>;
    correlationId: string | null;
  }>;
  return {
    releaseId: data.releaseId ?? "",
    trackId: data.trackId ?? null,
    assetId: data.assetId ?? null,
    sourceUrl: data.sourceUrl ?? null,
    release: data.release ?? null,
    track: data.track ?? null,
    sampleRateHz: "sampleRateHz" in data ? data.sampleRateHz ?? null : null,
    pcmBuffer: "pcmBuffer" in data ? data.pcmBuffer ?? null : null,
    metadata: data.metadata ?? {},
    actor: "worker",
    correlationId: data.correlationId ?? null,
  };
}

export class FingerprintWorker {
  constructor(private readonly deps: FingerprintWorkerDeps) {}

  async process(job: FingerprintJob) {
    const result = await this.deps.engine.generateFingerprint(toInput(job));
    await this.recordOutcome(job.releaseId, "FINGERPRINT_GENERATED", result.reviewActions.length ? "UPDATED" : "SUCCESS", { duplicates: result.duplicates.length, fraudSignals: result.fraudSignals.length });
    incrementMetric("tracksyra_fingerprint_worker_completed_total", { queue: queueNames.fingerprint });
    return result;
  }

  private async recordOutcome(releaseId: string, action: string, status: string, metadata: Readonly<Record<string, unknown>>) {
    if (!this.deps.operations) return;
    await this.deps.operations.recordAuditEvent({
      aggregateType: "audio_fingerprint",
      aggregateId: releaseId,
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
}

export class DuplicateDetectionWorker {
  constructor(private readonly deps: FingerprintWorkerDeps) {}

  async process(job: DuplicateDetectionJob) {
    const result = await this.deps.engine.findDuplicates(toInput(job));
    incrementMetric("tracksyra_duplicate_worker_completed_total", { queue: queueNames.duplicate });
    return result;
  }
}

export class SimilarityWorker {
  constructor(private readonly deps: FingerprintWorkerDeps) {}

  async process(job: SimilarityJob) {
    const result = await this.deps.engine.findSimilarTracks(toInput(job));
    incrementMetric("tracksyra_similarity_worker_completed_total", { queue: queueNames.similarity });
    return result;
  }
}

export class FraudAudioWorker {
  constructor(private readonly deps: FingerprintWorkerDeps) {}

  async process(job: AudioFraudJob) {
    const result = await this.deps.engine.detectFraud(toInput(job));
    incrementMetric("tracksyra_audio_fraud_worker_completed_total", { queue: queueNames.audioFraud });
    return result;
  }
}

export class FingerprintRetryWorker {
  constructor(private readonly deps: FingerprintWorkerDeps) {}

  async process(job: FingerprintRetryJob) {
    recordRetry(queueNames.fingerprintRetry);
    const result = await this.deps.engine.retry({ ...toInput(job), attempt: job.attempt ?? 1, error: job.error ?? null });
    incrementMetric("tracksyra_fingerprint_retry_worker_completed_total", { queue: queueNames.fingerprintRetry });
    return result;
  }
}

export class FingerprintAuditWorker {
  constructor(private readonly deps: FingerprintWorkerDeps) {}

  async process(job: FingerprintAuditJob) {
    const result = await this.deps.engine.generateDashboard({
      releaseId: job.releaseId ?? null,
      kind: job.reportKind ?? "fingerprint",
    });
    setWorkerHealth(queueNames.fingerprintAudit, "healthy");
    incrementMetric("tracksyra_fingerprint_audit_worker_completed_total", { queue: queueNames.fingerprintAudit });
    return result;
  }
}

export function registerFingerprintWorker(deps: FingerprintWorkerDeps, options: { concurrency?: number } = {}) {
  return createWorker(queueNames.fingerprint, async (job) => {
    const data = job.data as FingerprintJob;
    return new FingerprintWorker(deps).process(data);
  }, { concurrency: options.concurrency });
}

export function registerDuplicateDetectionWorker(deps: FingerprintWorkerDeps, options: { concurrency?: number } = {}) {
  return createWorker(queueNames.duplicate, async (job) => {
    const data = job.data as DuplicateDetectionJob;
    return new DuplicateDetectionWorker(deps).process(data);
  }, { concurrency: options.concurrency });
}

export function registerSimilarityWorker(deps: FingerprintWorkerDeps, options: { concurrency?: number } = {}) {
  return createWorker(queueNames.similarity, async (job) => {
    const data = job.data as SimilarityJob;
    return new SimilarityWorker(deps).process(data);
  }, { concurrency: options.concurrency });
}

export function registerFraudAudioWorker(deps: FingerprintWorkerDeps, options: { concurrency?: number } = {}) {
  return createWorker(queueNames.audioFraud, async (job) => {
    const data = job.data as AudioFraudJob;
    return new FraudAudioWorker(deps).process(data);
  }, { concurrency: options.concurrency });
}

export function registerFingerprintRetryWorker(deps: FingerprintWorkerDeps, options: { concurrency?: number } = {}) {
  return createWorker(queueNames.fingerprintRetry, async (job) => {
    const data = job.data as FingerprintRetryJob;
    return new FingerprintRetryWorker(deps).process(data);
  }, { concurrency: options.concurrency });
}

export function registerFingerprintAuditWorker(deps: FingerprintWorkerDeps, options: { concurrency?: number } = {}) {
  return createWorker(queueNames.fingerprintAudit, async (job) => {
    const data = job.data as FingerprintAuditJob;
    return new FingerprintAuditWorker(deps).process(data);
  }, { concurrency: options.concurrency });
}
