import { createWorker, type WorkerLike } from "../../queue/queueFactory";
import { queueNames } from "../../queue/queueNames";
import type {
  RoyaltyAdjustmentJob,
  RoyaltyAuditJob,
  RoyaltyCalculationJob,
  RoyaltyCurrencyJob,
  RoyaltyForecastJob,
  RoyaltyPaymentJob,
  RoyaltyReserveJob,
  RoyaltyRetryJob,
  RoyaltyStatementJob,
  RoyaltyTaxJob,
} from "../../queue/jobTypes";
import type { RoyaltyAccountingService } from "../../royalties/accounting/royaltyAccountingService";

type RoyaltyWorkerDeps = Pick<
  RoyaltyAccountingService,
  | "calculateRoyalties"
  | "generateStatement"
  | "approveStatement"
  | "releasePayment"
  | "calculateSplits"
  | "calculateTaxes"
  | "convertCurrency"
  | "applyAdjustment"
  | "applyChargeback"
  | "applyReserve"
  | "generateForecast"
  | "generateRevenueReport"
  | "generatePaymentReport"
  | "generateAuditReport"
  | "healthCheck"
  | "retry"
>;

export function registerRoyaltyCalculationWorker(service: RoyaltyWorkerDeps, options: { concurrency?: number } = {}): WorkerLike {
  return createWorker(queueNames.royaltyCalculation, async (job) => {
    const data = job.data as RoyaltyCalculationJob;
    if (data.type !== "CALCULATE_ROYALTIES") return;
    await service.calculateRoyalties(data.input);
  }, { concurrency: options.concurrency });
}

export function registerStatementWorker(service: RoyaltyWorkerDeps, options: { concurrency?: number } = {}): WorkerLike {
  return createWorker(queueNames.statement, async (job) => {
    const data = job.data as RoyaltyStatementJob;
    if (data.type !== "GENERATE_STATEMENT") return;
    await service.generateStatement(data.input);
  }, { concurrency: options.concurrency });
}

export function registerCurrencyWorker(service: RoyaltyWorkerDeps, options: { concurrency?: number } = {}): WorkerLike {
  return createWorker(queueNames.currency, async (job) => {
    const data = job.data as RoyaltyCurrencyJob;
    if (data.type !== "CONVERT_CURRENCY") return;
    await service.convertCurrency(data.input);
  }, { concurrency: options.concurrency });
}

export function registerTaxWorker(service: RoyaltyWorkerDeps, options: { concurrency?: number } = {}): WorkerLike {
  return createWorker(queueNames.tax, async (job) => {
    const data = job.data as RoyaltyTaxJob;
    if (data.type !== "CALCULATE_TAXES") return;
    await service.calculateTaxes(data.input);
  }, { concurrency: options.concurrency });
}

export function registerReserveWorker(service: RoyaltyWorkerDeps, options: { concurrency?: number } = {}): WorkerLike {
  return createWorker(queueNames.reserve, async (job) => {
    const data = job.data as RoyaltyReserveJob;
    if (data.type !== "APPLY_RESERVE") return;
    await service.applyReserve(data.input);
  }, { concurrency: options.concurrency });
}

export function registerAdjustmentWorker(service: RoyaltyWorkerDeps, options: { concurrency?: number } = {}): WorkerLike {
  return createWorker(queueNames.adjustment, async (job) => {
    const data = job.data as RoyaltyAdjustmentJob;
    if (data.type !== "APPLY_ADJUSTMENT") return;
    await service.applyAdjustment(data.input);
  }, { concurrency: options.concurrency });
}

export function registerPaymentWorker(service: RoyaltyWorkerDeps, options: { concurrency?: number } = {}): WorkerLike {
  return createWorker(queueNames.payment, async (job) => {
    const data = job.data as RoyaltyPaymentJob;
    if (data.type !== "RELEASE_PAYMENT") return;
    await service.releasePayment({
      statementId: data.statementId,
      approverId: data.approverId,
      scheduledFor: data.scheduledFor ?? null,
      metadata: data.metadata ?? {},
    });
  }, { concurrency: options.concurrency });
}

export function registerForecastWorker(service: RoyaltyWorkerDeps, options: { concurrency?: number } = {}): WorkerLike {
  return createWorker(queueNames.forecast, async (job) => {
    const data = job.data as RoyaltyForecastJob;
    if (data.type !== "GENERATE_FORECAST") return;
    await service.generateForecast(data.input);
  }, { concurrency: options.concurrency });
}

export function registerRoyaltyAuditWorker(service: RoyaltyWorkerDeps, options: { concurrency?: number } = {}): WorkerLike {
  return createWorker(queueNames.royaltyAudit, async (job) => {
    const data = job.data as RoyaltyAuditJob;
    if (data.type !== "GENERATE_AUDIT_REPORT") return;
    await service.generateAuditReport({ currency: data.currency, payeeId: data.payeeId ?? null });
  }, { concurrency: options.concurrency });
}

export function registerRoyaltyRetryWorker(service: RoyaltyWorkerDeps, options: { concurrency?: number } = {}): WorkerLike {
  return createWorker(queueNames.royaltyRetry, async (job) => {
    const data = job.data as RoyaltyRetryJob;
    if (data.type !== "RETRY_ROYALTY_JOB") return;
    await service.retry({ queueName: data.queueName, jobId: data.jobId ?? null, reason: data.reason ?? null, metadata: data.metadata ?? {} });
  }, { concurrency: options.concurrency });
}
