import { createWorker, type WorkerLike } from "../../queue/queueFactory";
import { queueNames } from "../../queue/queueNames";
import type {
  BackupJob,
  BackupVerificationJob,
  IncrementalBackupJob,
  RecoveryAuditJob,
  RestoreJob,
} from "../../queue/jobTypes";
import type { BackupDisasterRecoveryService } from "../../distribution/backup";

type BackupWorkerDeps = Readonly<{
  backupService: BackupDisasterRecoveryService;
}>;

function backupRequestFromJob(job: BackupJob | IncrementalBackupJob) {
  return {
    requestedBy: job.requestedBy ?? "system",
    reason: job.reason ?? null,
    scheduledFor: job.scheduledFor ?? null,
    retentionDays: job.retentionDays ?? null,
    scopes: job.scopes ?? undefined,
    metadata: job.metadata ?? {},
  };
}

function incrementalBackupRequestFromJob(job: IncrementalBackupJob) {
  return {
    ...backupRequestFromJob(job),
    previousBackupId: job.previousBackupId ?? null,
  };
}

export function registerBackupWorker(deps: BackupWorkerDeps, options: { concurrency?: number } = {}): WorkerLike {
  return createWorker(queueNames.backup, async (job) => {
    const data = job.data as BackupJob;
    if (data.backupMode === "scheduled") {
      await deps.backupService.createScheduledBackup(backupRequestFromJob(data));
      return;
    }
    if (data.backupMode === "manual") {
      await deps.backupService.createManualBackup(backupRequestFromJob(data));
      return;
    }
    await deps.backupService.createFullBackup(backupRequestFromJob(data));
  }, { concurrency: options.concurrency });
}

export function registerIncrementalBackupWorker(deps: BackupWorkerDeps, options: { concurrency?: number } = {}): WorkerLike {
  return createWorker(queueNames.incrementalBackup, async (job) => {
    const data = job.data as IncrementalBackupJob;
    await deps.backupService.createIncrementalBackup(incrementalBackupRequestFromJob(data));
  }, { concurrency: options.concurrency });
}

export function registerBackupVerificationWorker(deps: BackupWorkerDeps, options: { concurrency?: number } = {}): WorkerLike {
  return createWorker(queueNames.backupVerification, async (job) => {
    const data = job.data as BackupVerificationJob;
    await deps.backupService.verifyBackup(data.backupId);
  }, { concurrency: options.concurrency });
}

export function registerRestoreWorker(deps: BackupWorkerDeps, options: { concurrency?: number } = {}): WorkerLike {
  return createWorker(queueNames.restore, async (job) => {
    const data = job.data as RestoreJob;
    await deps.backupService.restoreBackup({
      backupId: data.backupId,
      requestedBy: data.requestedBy ?? "system",
      reason: data.reason ?? null,
      targetPointInTime: data.targetPointInTime ?? null,
      simulate: data.simulate ?? true,
      scopes: data.scopes ?? undefined,
    });
  }, { concurrency: options.concurrency });
}

export function registerRecoveryAuditWorker(deps: BackupWorkerDeps, options: { concurrency?: number } = {}): WorkerLike {
  return createWorker(queueNames.recoveryAudit, async (job) => {
    const data = job.data as RecoveryAuditJob;
    await deps.backupService.recordRecoveryAuditEvent({
      eventType: data.eventType ?? "recovery-plan-generated",
      backupId: data.backupId ?? null,
      actor: data.requestedBy ?? "system",
      correlationId: data.correlationId ?? null,
      details: {
        reason: data.reason ?? null,
        ...(data.details ?? {}),
        ...(data.metadata ?? {}),
      },
    });
  }, { concurrency: options.concurrency });
}
