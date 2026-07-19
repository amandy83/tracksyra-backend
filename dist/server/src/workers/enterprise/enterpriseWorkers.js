import { createWorker } from "../../queue/queueFactory.js";
import { queueNames } from "../../queue/queueNames.js";
export function registerReviewQueueWorker(service, options = {}) {
    return createWorker(queueNames.review, async (job) => {
        const data = job.data;
        if (!data.releaseId)
            return;
        await service.recordCatalogSnapshot(data.releaseId, toAuditContext(data));
        await service.recordRightsSnapshot(data.releaseId, toAuditContext(data));
        await service.recordIdentifierHistory(data.releaseId, toAuditContext(data));
    }, { concurrency: options.concurrency });
}
export function registerFraudReviewQueueWorker(service, options = {}) {
    return createWorker(queueNames.fraudReview, async (job) => {
        const data = job.data;
        if (!data.releaseId)
            return;
        await service.scoreFraud(data.releaseId, toAuditContext(data));
    }, { concurrency: options.concurrency });
}
export function registerValidationQueueWorker(service, options = {}) {
    return createWorker(queueNames.validation, async (job) => {
        const data = job.data;
        if (!data.releaseId)
            return;
        await service.recordCatalogSnapshot(data.releaseId, toAuditContext(data));
    }, { concurrency: options.concurrency });
}
export function registerDeliveryQueueWorker(service, options = {}) {
    return createWorker(queueNames.delivery, async (job) => {
        const data = job.data;
        if (!data.releaseId)
            return;
        await service.queueDelivery(data.releaseId, toAuditContext(data));
        await service.processDeliveryQueue(10);
    }, { concurrency: options.concurrency });
}
export function registerRetryQueueWorker(service, options = {}) {
    return createWorker(queueNames.retry, async (job) => {
        const data = job.data;
        void data;
        await service.processDeliveryQueue(10);
    }, { concurrency: options.concurrency });
}
export function registerWithdrawalQueueWorker(service, options = {}) {
    return createWorker(queueNames.withdrawal, async (job) => {
        const data = job.data;
        if (!data.releaseId)
            return;
        await service.recordAuditEvent({
            aggregateType: "withdrawal_queue",
            aggregateId: data.releaseId,
            action: "WITHDRAWAL_REQUESTED",
            actor: toAuditContext(data).actor,
            reason: data.reason ?? null,
            correlationId: toAuditContext(data).correlationId,
            oldValue: null,
            newValue: data,
            metadata: { queue: "withdrawal" },
            ipAddress: toAuditContext(data).ipAddress,
        });
    }, { concurrency: options.concurrency });
}
export function registerTakedownQueueWorker(service, options = {}) {
    return createWorker(queueNames.takedown, async (job) => {
        const data = job.data;
        if (!data.releaseId)
            return;
        await service.recordAuditEvent({
            aggregateType: "takedown_queue",
            aggregateId: data.releaseId,
            action: "TAKEDOWN_REQUESTED",
            actor: toAuditContext(data).actor,
            reason: data.reason ?? null,
            correlationId: toAuditContext(data).correlationId,
            oldValue: null,
            newValue: data,
            metadata: { queue: "takedown" },
            ipAddress: toAuditContext(data).ipAddress,
        });
    }, { concurrency: options.concurrency });
}
export function registerAuditQueueWorker(service, options = {}) {
    return createWorker(queueNames.audit, async (job) => {
        const data = job.data;
        await service.recordAuditEvent({
            aggregateType: data.aggregateType,
            aggregateId: data.aggregateId ?? "",
            action: data.action,
            actor: toAuditContext(data).actor,
            reason: data.reason ?? null,
            correlationId: toAuditContext(data).correlationId,
            oldValue: data.oldValue ?? null,
            newValue: data.newValue ?? null,
            metadata: { queue: "audit" },
            ipAddress: toAuditContext(data).ipAddress,
        });
    }, { concurrency: options.concurrency });
}
function toAuditContext(job) {
    return {
        actor: typeof job.actorUserId === "string" && job.actorUserId.trim() ? job.actorUserId : "system",
        ipAddress: null,
        correlationId: typeof job.correlationId === "string" ? job.correlationId : null,
        reason: typeof job.reason === "string" ? job.reason : null,
    };
}
