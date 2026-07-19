import { createWorker } from "../../queue/queueFactory.js";
import { queueNames } from "../../queue/queueNames.js";
function releaseMetadata(release) {
    return (release.metadata ?? {});
}
function resolveEndpoint(release) {
    const metadata = releaseMetadata(release);
    const candidates = [
        metadata.deezerDeliveryEndpoint,
        metadata.deezerMusicDeliveryEndpoint,
        metadata.deezerMusicIngestionUrl,
        metadata.deezerStatusEndpoint,
        metadata.deezerHealthEndpoint,
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
function buildDeliveryJob(job) {
    if (!job.release) {
        throw new Error("Deezer worker requires a release payload on the queue job.");
    }
    const releaseId = typeof job.releaseId === "string" && job.releaseId?.trim()
        ? job.releaseId.trim()
        : job.release.id.value;
    return {
        jobId: job.jobId ?? `${releaseId}:deezer`,
        releaseId,
        release: job.release,
        packageModel: job.packageModel ?? null,
        target: {
            connectorId: "Deezer",
            connectorVersion: "1.0.0",
            partnerName: "Deezer",
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
        metadata: { connectorId: "Deezer" },
        ipAddress: null,
    });
}
export class DeezerDeliveryWorker {
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
            action: result.success ? "DEEZER_MUSIC_DELIVERY_COMPLETED" : "DEEZER_MUSIC_DELIVERY_FAILED",
            actorUserId: job.actorUserId,
            correlationId: job.correlationId,
            reason: job.reason ?? null,
            metadata: this.dependencies.enterpriseService.generateDeliveryReport({ ...deliveryJob, packageModel }, result),
        });
    }
}
export class DeezerPollingWorker {
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
            action: "DEEZER_MUSIC_STATUS_POLLED",
            actorUserId: job.actorUserId,
            correlationId: job.correlationId,
            reason: null,
            metadata: { status },
        });
    }
}
export class DeezerRetryWorker {
    dependencies;
    constructor(dependencies) {
        this.dependencies = dependencies;
    }
    async process(job) {
        const deliveryJob = buildDeliveryJob(job);
        const packageModel = await this.dependencies.enterpriseService.buildPackage(deliveryJob);
        const retry = this.dependencies.enterpriseService.retry(new Error(job.reason ?? "Deezer retry requested"), 0, { ...deliveryJob, packageModel });
        await recordAudit(this.dependencies, {
            aggregateId: deliveryJob.releaseId,
            action: retry.retryCount > 0 ? "DEEZER_MUSIC_RETRY_SCHEDULED" : "DEEZER_MUSIC_RETRY_SKIPPED",
            actorUserId: job.actorUserId,
            correlationId: job.correlationId,
            reason: job.reason ?? null,
            metadata: retry,
        });
    }
}
export class DeezerWebhookWorker {
    dependencies;
    constructor(dependencies) {
        this.dependencies = dependencies;
    }
    async process(job) {
        const releaseJob = buildDeliveryJob(job);
        const packageModel = await this.dependencies.enterpriseService.buildPackage(releaseJob);
        const webhookResult = await this.dependencies.enterpriseService.handleWebhook({
            webhookId: `deezer:${releaseJob.releaseId}:${job.eventType}`,
            connectorId: "Deezer",
            releaseId: releaseJob.releaseId,
            eventType: job.eventType,
            receivedAt: job.createdAt,
            headers: job.headers ?? {},
            payload: job.payload ?? {},
            signatureValid: job.signatureValid ?? false,
        });
        await recordAudit(this.dependencies, {
            aggregateId: releaseJob.releaseId,
            action: job.signatureValid === false ? "DEEZER_MUSIC_WEBHOOK_REJECTED" : "DEEZER_MUSIC_WEBHOOK_PROCESSED",
            actorUserId: job.actorUserId,
            correlationId: job.correlationId,
            reason: job.source ?? null,
            metadata: {
                ...webhookResult,
                report: this.dependencies.enterpriseService.generateMetadataReport({ ...releaseJob, packageModel }),
            },
        });
    }
}
export class DeezerHealthWorker {
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
            action: "DEEZER_MUSIC_HEALTH_CHECKED",
            actorUserId: job.actorUserId,
            correlationId: job.correlationId,
            reason: job.reason ?? null,
            metadata: this.dependencies.enterpriseService.generateHealthReport("Deezer", health),
        });
    }
}
export function registerDeezerDeliveryWorker(worker, options = {}) {
    return createWorker(queueNames.deezerDelivery, async (job) => {
        await worker.process(job.data);
    }, { concurrency: options.concurrency });
}
export function registerDeezerPollingWorker(worker, options = {}) {
    return createWorker(queueNames.deezerPolling, async (job) => {
        await worker.process(job.data);
    }, { concurrency: options.concurrency });
}
export function registerDeezerRetryWorker(worker, options = {}) {
    return createWorker(queueNames.deezerRetry, async (job) => {
        await worker.process(job.data);
    }, { concurrency: options.concurrency });
}
export function registerDeezerWebhookWorker(worker, options = {}) {
    return createWorker(queueNames.deezerWebhook, async (job) => {
        await worker.process(job.data);
    }, { concurrency: options.concurrency });
}
export function registerDeezerHealthWorker(worker, options = {}) {
    return createWorker(queueNames.deezerHealth, async (job) => {
        await worker.process(job.data);
    }, { concurrency: options.concurrency });
}
