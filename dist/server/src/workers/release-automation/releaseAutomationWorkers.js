import { createWorker } from "../../queue/queueFactory.js";
import { queueNames } from "../../queue/queueNames.js";
import { incrementMetric, recordRetry, setWorkerHealth } from "../../queue/metrics.js";
export class ReleaseSchedulerWorker {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    async process(job) {
        const result = await this.deps.engine.scheduleRelease({ ...job, metadata: job.metadata ?? {} });
        incrementMetric("tracksyra_release_scheduler_worker_completed_total", { queue: queueNames.releaseScheduler });
        return result;
    }
}
export class DeliveryOrchestratorWorker {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    async process(job) {
        const result = await this.deps.engine.orchestrateDelivery({ ...job, metadata: job.metadata ?? {} });
        incrementMetric("tracksyra_delivery_orchestrator_worker_completed_total", { queue: queueNames.deliveryOrchestration });
        return result;
    }
}
export class DeliveryRetryWorker {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    async process(job) {
        recordRetry(queueNames.deliveryRetry);
        const result = await this.deps.engine.retryDelivery({ ...job, metadata: job.metadata ?? {}, attempt: job.attempt ?? 1, error: job.error ?? null });
        incrementMetric("tracksyra_delivery_retry_worker_completed_total", { queue: queueNames.deliveryRetry });
        return result;
    }
}
export class DeliveryRollbackWorker {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    async process(job) {
        const result = await this.deps.engine.rollbackRelease({ ...job, metadata: job.metadata ?? {} });
        incrementMetric("tracksyra_delivery_rollback_worker_completed_total", { queue: queueNames.rollback });
        return result;
    }
}
export class ReleaseApprovalWorker {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    async process(job) {
        const result = await this.deps.engine.approveRelease({
            releaseId: job.releaseId,
            trackId: job.trackId ?? null,
            approved: Boolean(job.approved ?? true),
            approverId: job.approverId ?? null,
            notes: job.notes ?? null,
            metadata: job.metadata ?? {},
        });
        incrementMetric("tracksyra_release_approval_worker_completed_total", { queue: queueNames.approval });
        return result;
    }
}
export class ReleaseAutomationWorker {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    async process(job) {
        const result = await this.deps.engine.orchestrateDelivery({ releaseId: job.releaseId, trackId: job.trackId ?? null, metadata: job.metadata ?? {}, release: job.release ?? null, track: job.track ?? null });
        incrementMetric("tracksyra_release_automation_worker_completed_total", { queue: queueNames.automation });
        return result;
    }
}
export class DeliveryAuditWorker {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    async process(job) {
        const result = await (job.reportKind === "calendar"
            ? this.deps.engine.generateReleaseCalendarReport()
            : job.reportKind === "delivery"
                ? this.deps.engine.generateDeliveryReport()
                : job.reportKind === "failure"
                    ? this.deps.engine.generateDeliveryFailureReport()
                    : job.reportKind === "retry"
                        ? this.deps.engine.generateRetryReport()
                        : job.reportKind === "sla"
                            ? this.deps.engine.generateSlaReport()
                            : job.reportKind === "automation"
                                ? this.deps.engine.generateReleaseAutomationReport()
                                : job.reportKind === "health"
                                    ? this.deps.engine.generateDeliveryHealthReport()
                                    : this.deps.engine.generateWorkflowReport());
        setWorkerHealth(queueNames.deliveryAudit, "healthy");
        incrementMetric("tracksyra_delivery_audit_worker_completed_total", { queue: queueNames.deliveryAudit });
        return result;
    }
}
export class WebhookProcessingWorker {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    async process(job) {
        const result = await this.deps.engine.processWebhook({ releaseId: job.releaseId, trackId: job.trackId ?? null, source: job.source ?? null, payload: job.payload ?? {}, metadata: job.metadata ?? {} });
        incrementMetric("tracksyra_delivery_webhook_worker_completed_total", { queue: queueNames.deliveryWebhook });
        return result;
    }
}
export class DeliveryHealthWorker {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    async process(job) {
        void job;
        const result = await this.deps.engine.healthCheck();
        setWorkerHealth(queueNames.deliveryHealth, "healthy");
        incrementMetric("tracksyra_delivery_health_worker_completed_total", { queue: queueNames.deliveryHealth });
        return result;
    }
}
export class SLAWorker {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    async process(job) {
        void job;
        const result = await this.deps.engine.generateSlaReport();
        incrementMetric("tracksyra_sla_worker_completed_total", { queue: queueNames.sla });
        return result;
    }
}
export function registerReleaseSchedulerWorker(deps, options = {}) {
    return createWorker(queueNames.releaseScheduler, async (job) => new ReleaseSchedulerWorker(deps).process(job.data), { concurrency: options.concurrency });
}
export function registerDeliveryOrchestratorWorker(deps, options = {}) {
    return createWorker(queueNames.deliveryOrchestration, async (job) => new DeliveryOrchestratorWorker(deps).process(job.data), { concurrency: options.concurrency });
}
export function registerDeliveryRetryWorker(deps, options = {}) {
    return createWorker(queueNames.deliveryRetry, async (job) => new DeliveryRetryWorker(deps).process(job.data), { concurrency: options.concurrency });
}
export function registerDeliveryRollbackWorker(deps, options = {}) {
    return createWorker(queueNames.rollback, async (job) => new DeliveryRollbackWorker(deps).process(job.data), { concurrency: options.concurrency });
}
export function registerReleaseApprovalWorker(deps, options = {}) {
    return createWorker(queueNames.approval, async (job) => new ReleaseApprovalWorker(deps).process(job.data), { concurrency: options.concurrency });
}
export function registerReleaseAutomationWorker(deps, options = {}) {
    return createWorker(queueNames.automation, async (job) => new ReleaseAutomationWorker(deps).process(job.data), { concurrency: options.concurrency });
}
export function registerDeliveryAuditWorker(deps, options = {}) {
    return createWorker(queueNames.deliveryAudit, async (job) => new DeliveryAuditWorker(deps).process(job.data), { concurrency: options.concurrency });
}
export function registerWebhookProcessingWorker(deps, options = {}) {
    return createWorker(queueNames.deliveryWebhook, async (job) => new WebhookProcessingWorker(deps).process(job.data), { concurrency: options.concurrency });
}
export function registerDeliveryHealthWorker(deps, options = {}) {
    return createWorker(queueNames.deliveryHealth, async (job) => new DeliveryHealthWorker(deps).process(job.data), { concurrency: options.concurrency });
}
export function registerSLAWorker(deps, options = {}) {
    return createWorker(queueNames.sla, async (job) => new SLAWorker(deps).process(job.data), { concurrency: options.concurrency });
}
