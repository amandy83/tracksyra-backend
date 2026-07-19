import { createWorker } from "../../queue/queueFactory.js";
import { queueNames } from "../../queue/queueNames.js";
function releaseMetadata(release) {
    return (release.metadata ?? {});
}
function resolveEndpoint(release) {
    const metadata = releaseMetadata(release);
    const candidates = [
        metadata.BoomplayDeliveryEndpoint,
        metadata.BoomplayMusicDeliveryEndpoint,
        metadata.BoomplayMusicIngestionUrl,
        metadata.BoomplayStatusEndpoint,
        metadata.BoomplayHealthEndpoint,
        metadata.dspDeliveryEndpoint,
        metadata.dspStatusEndpoint,
        metadata.dspHealthEndpoint,
        metadata.deliveryEndpointUrl,
    ];
    for (const candidate of candidates) {
        if (typeof candidate === "string" && candidate.trim())
            return candidate.trim();
    }
    return null;
}
function resolveReleaseId(job) {
    const explicit = typeof job.releaseId === "string" ? job.releaseId.trim() : "";
    if (explicit)
        return explicit;
    const releaseId = job.release?.id;
    return typeof releaseId === "string" ? releaseId : "";
}
function buildDeliveryJob(job) {
    if (!job.release) {
        throw new Error("Boomplay worker requires a release payload on the queue job.");
    }
    const releaseId = resolveReleaseId(job);
    return {
        jobId: job.jobId ?? `${releaseId}:boomplay`,
        releaseId,
        release: job.release,
        packageModel: job.packageModel ?? null,
        target: {
            connectorId: "Boomplay",
            connectorVersion: "1.0.0",
            partnerName: "Boomplay",
            endpointUrl: resolveEndpoint(job.release),
            territories: job.release.territories.values.length ? job.release.territories.values : ["WORLD"],
            metadata: {
                actorUserId: job.actorUserId,
                correlationId: job.correlationId,
                sourceSystem: job.sourceSystem,
                reason: "reason" in job ? job.reason ?? null : null,
                eventType: "eventType" in job ? job.eventType : null,
            },
        },
        requestedBy: job.actorUserId ?? null,
        scheduledFor: null,
        metadata: {
            sourceSystem: job.sourceSystem,
            correlationId: job.correlationId,
            reason: "reason" in job ? job.reason ?? null : null,
            deliveryQueueId: "deliveryQueueId" in job ? job.deliveryQueueId ?? null : null,
        },
    };
}
async function recordAudit(dependencies, input) {
    await dependencies.enterpriseOperationsService.recordAuditEvent({
        aggregateType: "delivery_queue",
        aggregateId: input.aggregateId,
        action: input.action,
        actor: input.actorUserId ?? "system",
        reason: input.reason,
        correlationId: input.correlationId,
        oldValue: null,
        newValue: input.metadata ?? {},
        metadata: { connectorId: "Boomplay" },
        ipAddress: null,
    });
}
export class BoomplayDeliveryWorker {
    dependencies;
    constructor(dependencies) {
        this.dependencies = dependencies;
    }
    async process(job) {
        const deliveryJob = buildDeliveryJob(job);
        const packageModel = await this.dependencies.enterpriseService.buildPackage(deliveryJob);
        const result = await this.dependencies.enterpriseService.deliver({ ...deliveryJob, packageModel });
        await recordAudit(this.dependencies, {
            aggregateId: deliveryJob.releaseId,
            action: result.success ? "BOOMPLAY_MUSIC_DELIVERY_COMPLETED" : "BOOMPLAY_MUSIC_DELIVERY_FAILED",
            actorUserId: job.actorUserId,
            correlationId: job.correlationId,
            reason: job.reason ?? null,
            metadata: this.dependencies.enterpriseService.generateDeliveryReport({ ...deliveryJob, packageModel }, result),
        });
    }
}
export class BoomplayPollingWorker {
    dependencies;
    constructor(dependencies) {
        this.dependencies = dependencies;
    }
    async process(job) {
        const deliveryJob = buildDeliveryJob(job);
        const packageModel = await this.dependencies.enterpriseService.buildPackage(deliveryJob);
        const status = await this.dependencies.enterpriseService.pollStatus({ ...deliveryJob, packageModel });
        await recordAudit(this.dependencies, {
            aggregateId: deliveryJob.releaseId,
            action: "BOOMPLAY_MUSIC_STATUS_POLLED",
            actorUserId: job.actorUserId,
            correlationId: job.correlationId,
            reason: null,
            metadata: { status },
        });
    }
}
export class BoomplayRetryWorker {
    dependencies;
    constructor(dependencies) {
        this.dependencies = dependencies;
    }
    async process(job) {
        const deliveryJob = buildDeliveryJob(job);
        const packageModel = await this.dependencies.enterpriseService.buildPackage(deliveryJob);
        const retry = this.dependencies.enterpriseService.retry(new Error(job.reason ?? "Boomplay retry requested"), 0, { ...deliveryJob, packageModel });
        await recordAudit(this.dependencies, {
            aggregateId: deliveryJob.releaseId,
            action: retry.retryCount > 0 ? "BOOMPLAY_MUSIC_RETRY_SCHEDULED" : "BOOMPLAY_MUSIC_RETRY_SKIPPED",
            actorUserId: job.actorUserId,
            correlationId: job.correlationId,
            reason: job.reason ?? null,
            metadata: retry,
        });
    }
}
export class BoomplayWebhookWorker {
    dependencies;
    constructor(dependencies) {
        this.dependencies = dependencies;
    }
    async process(job) {
        const deliveryJob = buildDeliveryJob(job);
        const packageModel = await this.dependencies.enterpriseService.buildPackage(deliveryJob);
        const webhookResult = await this.dependencies.enterpriseService.handleWebhook({
            webhookId: `Boomplay:${job.releaseId}:${job.eventType}`,
            connectorId: "Boomplay",
            releaseId: job.releaseId,
            eventType: job.eventType,
            receivedAt: job.createdAt,
            headers: job.headers ?? {},
            payload: job.payload ?? {},
            signatureValid: job.signatureValid ?? false,
        });
        await recordAudit(this.dependencies, {
            aggregateId: deliveryJob.releaseId,
            action: job.signatureValid === false ? "BOOMPLAY_MUSIC_WEBHOOK_REJECTED" : "BOOMPLAY_MUSIC_WEBHOOK_PROCESSED",
            actorUserId: job.actorUserId,
            correlationId: job.correlationId,
            reason: job.source ?? null,
            metadata: {
                ...webhookResult,
                report: this.dependencies.enterpriseService.generateMetadataReport({ ...deliveryJob, packageModel }),
            },
        });
    }
}
export class BoomplayHealthWorker {
    dependencies;
    constructor(dependencies) {
        this.dependencies = dependencies;
    }
    async process(job) {
        const deliveryJob = buildDeliveryJob(job);
        const packageModel = await this.dependencies.enterpriseService.buildPackage(deliveryJob);
        const health = await this.dependencies.enterpriseService.healthCheck({ ...deliveryJob, packageModel });
        await recordAudit(this.dependencies, {
            aggregateId: deliveryJob.releaseId,
            action: "BOOMPLAY_MUSIC_HEALTH_CHECKED",
            actorUserId: job.actorUserId,
            correlationId: job.correlationId,
            reason: job.reason ?? null,
            metadata: this.dependencies.enterpriseService.generateHealthReport("Boomplay", health),
        });
    }
}
export function registerBoomplayDeliveryWorker(worker, options = {}) {
    return createWorker(queueNames.boomplayDelivery, async (job) => {
        await worker.process(job.data);
    }, { concurrency: options.concurrency });
}
export function registerBoomplayPollingWorker(worker, options = {}) {
    return createWorker(queueNames.boomplayPolling, async (job) => {
        await worker.process(job.data);
    }, { concurrency: options.concurrency });
}
export function registerBoomplayRetryWorker(worker, options = {}) {
    return createWorker(queueNames.boomplayRetry, async (job) => {
        await worker.process(job.data);
    }, { concurrency: options.concurrency });
}
export function registerBoomplayWebhookWorker(worker, options = {}) {
    return createWorker(queueNames.boomplayWebhook, async (job) => {
        await worker.process(job.data);
    }, { concurrency: options.concurrency });
}
export function registerBoomplayHealthWorker(worker, options = {}) {
    return createWorker(queueNames.boomplayHealth, async (job) => {
        await worker.process(job.data);
    }, { concurrency: options.concurrency });
}
