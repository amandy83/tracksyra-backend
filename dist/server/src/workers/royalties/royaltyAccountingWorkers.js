import { createWorker } from "../../queue/queueFactory.js";
import { queueNames } from "../../queue/queueNames.js";
export function registerRoyaltyCalculationWorker(service, options = {}) {
    return createWorker(queueNames.royaltyCalculation, async (job) => {
        const data = job.data;
        if (data.type !== "CALCULATE_ROYALTIES")
            return;
        await service.calculateRoyalties(data.input);
    }, { concurrency: options.concurrency });
}
export function registerStatementWorker(service, options = {}) {
    return createWorker(queueNames.statement, async (job) => {
        const data = job.data;
        if (data.type !== "GENERATE_STATEMENT")
            return;
        await service.generateStatement(data.input);
    }, { concurrency: options.concurrency });
}
export function registerCurrencyWorker(service, options = {}) {
    return createWorker(queueNames.currency, async (job) => {
        const data = job.data;
        if (data.type !== "CONVERT_CURRENCY")
            return;
        await service.convertCurrency(data.input);
    }, { concurrency: options.concurrency });
}
export function registerTaxWorker(service, options = {}) {
    return createWorker(queueNames.tax, async (job) => {
        const data = job.data;
        if (data.type !== "CALCULATE_TAXES")
            return;
        await service.calculateTaxes(data.input);
    }, { concurrency: options.concurrency });
}
export function registerReserveWorker(service, options = {}) {
    return createWorker(queueNames.reserve, async (job) => {
        const data = job.data;
        if (data.type !== "APPLY_RESERVE")
            return;
        await service.applyReserve(data.input);
    }, { concurrency: options.concurrency });
}
export function registerAdjustmentWorker(service, options = {}) {
    return createWorker(queueNames.adjustment, async (job) => {
        const data = job.data;
        if (data.type !== "APPLY_ADJUSTMENT")
            return;
        await service.applyAdjustment(data.input);
    }, { concurrency: options.concurrency });
}
export function registerPaymentWorker(service, options = {}) {
    return createWorker(queueNames.payment, async (job) => {
        const data = job.data;
        if (data.type !== "RELEASE_PAYMENT")
            return;
        await service.releasePayment({
            statementId: data.statementId,
            approverId: data.approverId,
            scheduledFor: data.scheduledFor ?? null,
            metadata: data.metadata ?? {},
        });
    }, { concurrency: options.concurrency });
}
export function registerForecastWorker(service, options = {}) {
    return createWorker(queueNames.forecast, async (job) => {
        const data = job.data;
        if (data.type !== "GENERATE_FORECAST")
            return;
        await service.generateForecast(data.input);
    }, { concurrency: options.concurrency });
}
export function registerRoyaltyAuditWorker(service, options = {}) {
    return createWorker(queueNames.royaltyAudit, async (job) => {
        const data = job.data;
        if (data.type !== "GENERATE_AUDIT_REPORT")
            return;
        await service.generateAuditReport({ currency: data.currency, payeeId: data.payeeId ?? null });
    }, { concurrency: options.concurrency });
}
export function registerRoyaltyRetryWorker(service, options = {}) {
    return createWorker(queueNames.royaltyRetry, async (job) => {
        const data = job.data;
        if (data.type !== "RETRY_ROYALTY_JOB")
            return;
        await service.retry({ queueName: data.queueName, jobId: data.jobId ?? null, reason: data.reason ?? null, metadata: data.metadata ?? {} });
    }, { concurrency: options.concurrency });
}
