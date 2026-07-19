import { createWorker } from "../../queue/queueFactory.js";
import { queueNames } from "../../queue/queueNames.js";
function backupRequestFromJob(job) {
    return {
        requestedBy: job.requestedBy ?? "system",
        reason: job.reason ?? null,
        scheduledFor: job.scheduledFor ?? null,
        retentionDays: job.retentionDays ?? null,
        scopes: job.scopes ?? undefined,
        metadata: job.metadata ?? {},
    };
}
function incrementalBackupRequestFromJob(job) {
    return {
        ...backupRequestFromJob(job),
        previousBackupId: job.previousBackupId ?? null,
    };
}
export function registerBackupWorker(deps, options = {}) {
    return createWorker(queueNames.backup, async (job) => {
        const data = job.data;
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
export function registerIncrementalBackupWorker(deps, options = {}) {
    return createWorker(queueNames.incrementalBackup, async (job) => {
        const data = job.data;
        await deps.backupService.createIncrementalBackup(incrementalBackupRequestFromJob(data));
    }, { concurrency: options.concurrency });
}
export function registerBackupVerificationWorker(deps, options = {}) {
    return createWorker(queueNames.backupVerification, async (job) => {
        const data = job.data;
        await deps.backupService.verifyBackup(data.backupId);
    }, { concurrency: options.concurrency });
}
export function registerRestoreWorker(deps, options = {}) {
    return createWorker(queueNames.restore, async (job) => {
        const data = job.data;
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
export function registerRecoveryAuditWorker(deps, options = {}) {
    return createWorker(queueNames.recoveryAudit, async (job) => {
        const data = job.data;
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
