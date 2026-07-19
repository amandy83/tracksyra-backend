import { createWorker } from "../../queue/queueFactory.js";
import { queueNames } from "../../queue/queueNames.js";
export class AppleMusicDeliveryWorker {
    dependencies;
    constructor(dependencies) {
        this.dependencies = dependencies;
    }
    async process(job) {
        const deliveryJob = this.buildDeliveryJob(job);
        const validation = this.dependencies.releaseDeliveryEngine.validateConnectorRelease(deliveryJob);
        if (!validation.valid) {
            await this.dependencies.enterpriseOperationsService.recordAuditEvent({
                aggregateType: "delivery_queue",
                aggregateId: job.releaseId,
                action: "APPLE_MUSIC_VALIDATION_FAILED",
                actor: job.actorUserId ?? "system",
                reason: job.reason ?? "Apple Music release validation failed",
                correlationId: job.correlationId ?? null,
                oldValue: null,
                newValue: { validation },
                metadata: { connectorId: "AppleMusic" },
                ipAddress: null,
            });
            throw new Error(`Apple Music validation failed: ${validation.errors.map((entry) => entry.message).join("; ")}`);
        }
        const result = await this.dependencies.releaseDeliveryEngine.deliverConnector(deliveryJob);
        await this.dependencies.enterpriseOperationsService.recordAuditEvent({
            aggregateType: "delivery_queue",
            aggregateId: job.releaseId,
            action: result.success ? "APPLE_MUSIC_DELIVERY_COMPLETED" : "APPLE_MUSIC_DELIVERY_FAILED",
            actor: job.actorUserId ?? "system",
            reason: job.reason ?? null,
            correlationId: job.correlationId ?? null,
            oldValue: null,
            newValue: result,
            metadata: { connectorId: "AppleMusic" },
            ipAddress: null,
        });
    }
    buildDeliveryJob(job) {
        const release = this.requireRelease(job);
        return this.dependencies.releaseDeliveryEngine.buildConnectorDeliveryJob(release, {
            connectorId: "AppleMusic",
            partnerName: "AppleMusic",
            endpointUrl: this.resolveEndpoint(release),
            territories: release.territories.values.length ? release.territories.values : ["WORLD"],
            metadata: {
                actorUserId: job.actorUserId,
                correlationId: job.correlationId,
                sourceSystem: job.sourceSystem,
                reason: job.reason ?? null,
            },
            connectorVersion: release.version?.value ?? "1.0.0",
        }, {
            requestedBy: job.actorUserId ?? null,
            scheduledFor: null,
            metadata: {
                sourceSystem: job.sourceSystem,
                reason: job.reason ?? null,
            },
        });
    }
    requireRelease(job) {
        if (!job.release) {
            throw new Error("Apple Music delivery worker requires a release payload on the queue job.");
        }
        return job.release;
    }
    resolveEndpoint(release) {
        const metadata = release.metadata;
        const candidates = [
            metadata.appleMusicDeliveryEndpoint,
            metadata.appleMusicIngestionUrl,
            metadata.dspDeliveryEndpoint,
            metadata.deliveryEndpointUrl,
        ];
        for (const candidate of candidates) {
            if (typeof candidate === "string" && candidate.trim())
                return candidate.trim();
        }
        return null;
    }
}
export class AppleMusicPollingWorker {
    dependencies;
    constructor(dependencies) {
        this.dependencies = dependencies;
    }
    async process(job) {
        const deliveryJob = this.buildDeliveryJob(job);
        const status = await this.dependencies.releaseDeliveryEngine.pollConnectorStatus(deliveryJob);
        await this.record(job, "APPLE_MUSIC_STATUS_POLLED", {
            providerStatus: status.providerStatus,
            status: status.status,
            observedAt: status.observedAt,
        });
    }
    buildDeliveryJob(job) {
        const release = this.requireRelease(job);
        return this.dependencies.releaseDeliveryEngine.buildConnectorDeliveryJob(release, {
            connectorId: "AppleMusic",
            partnerName: "AppleMusic",
            endpointUrl: this.resolveEndpoint(release),
            territories: release.territories.values.length ? release.territories.values : ["WORLD"],
            metadata: {
                actorUserId: job.actorUserId,
                correlationId: job.correlationId,
                sourceSystem: job.sourceSystem,
            },
            connectorVersion: release.version?.value ?? "1.0.0",
        });
    }
    async record(job, action, metadata) {
        await this.dependencies.enterpriseOperationsService.recordAuditEvent({
            aggregateType: "delivery_queue",
            aggregateId: job.releaseId,
            action,
            actor: job.actorUserId ?? "system",
            reason: null,
            correlationId: job.correlationId ?? null,
            oldValue: null,
            newValue: metadata,
            metadata: { connectorId: "AppleMusic" },
            ipAddress: null,
        });
    }
    requireRelease(job) {
        if (!job.release) {
            throw new Error("Apple Music polling worker requires a release payload on the queue job.");
        }
        return job.release;
    }
    resolveEndpoint(release) {
        const metadata = release.metadata;
        const candidates = [
            metadata.appleMusicStatusEndpoint,
            metadata.appleMusicDeliveryEndpoint,
            metadata.appleMusicIngestionUrl,
            metadata.dspStatusEndpoint,
        ];
        for (const candidate of candidates) {
            if (typeof candidate === "string" && candidate.trim())
                return candidate.trim();
        }
        return null;
    }
}
export class AppleMusicRetryWorker {
    dependencies;
    constructor(dependencies) {
        this.dependencies = dependencies;
    }
    async process(job) {
        const deliveryJob = this.buildDeliveryJob(job);
        const retryDecision = await this.dependencies.releaseDeliveryEngine.retryConnector(deliveryJob, 0, job.reason ?? null);
        await this.dependencies.enterpriseOperationsService.recordAuditEvent({
            aggregateType: "delivery_queue",
            aggregateId: job.releaseId,
            action: retryDecision.nextAttemptAt ? "APPLE_MUSIC_RETRY_SCHEDULED" : "APPLE_MUSIC_RETRY_SKIPPED",
            actor: job.actorUserId ?? "system",
            reason: job.reason ?? null,
            correlationId: job.correlationId ?? null,
            oldValue: null,
            newValue: retryDecision,
            metadata: { connectorId: "AppleMusic", deliveryQueueId: job.deliveryQueueId ?? null },
            ipAddress: null,
        });
    }
    buildDeliveryJob(job) {
        const release = this.requireRelease(job);
        return this.dependencies.releaseDeliveryEngine.buildConnectorDeliveryJob(release, {
            connectorId: "AppleMusic",
            partnerName: "AppleMusic",
            endpointUrl: this.resolveEndpoint(release),
            territories: release.territories.values.length ? release.territories.values : ["WORLD"],
            metadata: {
                actorUserId: job.actorUserId,
                correlationId: job.correlationId,
                sourceSystem: job.sourceSystem,
            },
            connectorVersion: release.version?.value ?? "1.0.0",
        });
    }
    requireRelease(job) {
        if (!job.release) {
            throw new Error("Apple Music retry worker requires a release payload on the queue job.");
        }
        return job.release;
    }
    resolveEndpoint(release) {
        const metadata = release.metadata;
        const candidates = [
            metadata.appleMusicDeliveryEndpoint,
            metadata.appleMusicIngestionUrl,
            metadata.dspDeliveryEndpoint,
            metadata.deliveryEndpointUrl,
        ];
        for (const candidate of candidates) {
            if (typeof candidate === "string" && candidate.trim())
                return candidate.trim();
        }
        return null;
    }
}
export class AppleMusicWebhookWorker {
    dependencies;
    constructor(dependencies) {
        this.dependencies = dependencies;
    }
    async process(job) {
        const deliveryJob = this.buildDeliveryJob(job);
        const status = await this.dependencies.releaseDeliveryEngine.pollConnectorStatus(deliveryJob);
        await this.dependencies.enterpriseOperationsService.recordAuditEvent({
            aggregateType: "delivery_queue",
            aggregateId: job.releaseId,
            action: job.signatureValid === false ? "APPLE_MUSIC_WEBHOOK_REJECTED" : "APPLE_MUSIC_WEBHOOK_PROCESSED",
            actor: job.actorUserId ?? "system",
            reason: job.source ?? null,
            correlationId: job.correlationId ?? null,
            oldValue: null,
            newValue: {
                connectorId: "AppleMusic",
                eventType: job.eventType,
                signatureValid: job.signatureValid ?? false,
                providerStatus: status.providerStatus,
                status: status.status,
                payload: job.payload ?? {},
            },
            metadata: { connectorId: "AppleMusic", headers: job.headers ?? {} },
            ipAddress: null,
        });
    }
    buildDeliveryJob(job) {
        const release = this.requireRelease(job);
        return this.dependencies.releaseDeliveryEngine.buildConnectorDeliveryJob(release, {
            connectorId: "AppleMusic",
            partnerName: "AppleMusic",
            endpointUrl: this.resolveEndpoint(release),
            territories: release.territories.values.length ? release.territories.values : ["WORLD"],
            metadata: {
                actorUserId: job.actorUserId,
                correlationId: job.correlationId,
                sourceSystem: job.sourceSystem,
                eventType: job.eventType,
            },
            connectorVersion: release.version?.value ?? "1.0.0",
        });
    }
    requireRelease(job) {
        if (!job.release) {
            throw new Error("Apple Music webhook worker requires a release payload on the queue job.");
        }
        return job.release;
    }
    resolveEndpoint(release) {
        const metadata = release.metadata;
        const candidates = [
            metadata.appleMusicDeliveryEndpoint,
            metadata.appleMusicIngestionUrl,
            metadata.dspDeliveryEndpoint,
            metadata.deliveryEndpointUrl,
        ];
        for (const candidate of candidates) {
            if (typeof candidate === "string" && candidate.trim())
                return candidate.trim();
        }
        return null;
    }
}
export class AppleMusicHealthWorker {
    dependencies;
    constructor(dependencies) {
        this.dependencies = dependencies;
    }
    async process(job) {
        const release = this.requireRelease(job);
        const deliveryJob = this.dependencies.releaseDeliveryEngine.buildConnectorDeliveryJob(release, {
            connectorId: "AppleMusic",
            partnerName: "AppleMusic",
            endpointUrl: this.resolveEndpoint(release),
            territories: release.territories.values.length ? release.territories.values : ["WORLD"],
            metadata: {
                actorUserId: job.actorUserId,
                correlationId: job.correlationId,
                sourceSystem: job.sourceSystem,
            },
            connectorVersion: job.connectorId ?? "1.0.0",
        });
        const health = await this.dependencies.releaseDeliveryEngine.healthCheckConnector(deliveryJob);
        await this.dependencies.enterpriseOperationsService.recordAuditEvent({
            aggregateType: "delivery_queue",
            aggregateId: deliveryJob.releaseId,
            action: "APPLE_MUSIC_HEALTH_CHECKED",
            actor: job.actorUserId ?? "system",
            reason: job.reason ?? null,
            correlationId: job.correlationId ?? null,
            oldValue: null,
            newValue: health,
            metadata: { connectorId: "AppleMusic" },
            ipAddress: null,
        });
    }
    requireRelease(job) {
        if (!job.release) {
            throw new Error("Apple Music health worker requires a release payload on the queue job.");
        }
        return job.release;
    }
    resolveEndpoint(release) {
        const metadata = release.metadata;
        const candidates = [
            metadata.appleMusicHealthEndpoint,
            metadata.appleMusicDeliveryEndpoint,
            metadata.appleMusicIngestionUrl,
            metadata.dspHealthEndpoint,
        ];
        for (const candidate of candidates) {
            if (typeof candidate === "string" && candidate.trim())
                return candidate.trim();
        }
        return null;
    }
}
export function registerAppleMusicDeliveryWorker(worker, options = {}) {
    return createWorker(queueNames.appleMusicDelivery, async (job) => {
        await worker.process(job.data);
    }, { concurrency: options.concurrency });
}
export function registerAppleMusicPollingWorker(worker, options = {}) {
    return createWorker(queueNames.appleMusicPolling, async (job) => {
        await worker.process(job.data);
    }, { concurrency: options.concurrency });
}
export function registerAppleMusicRetryWorker(worker, options = {}) {
    return createWorker(queueNames.appleMusicRetry, async (job) => {
        await worker.process(job.data);
    }, { concurrency: options.concurrency });
}
export function registerAppleMusicWebhookWorker(worker, options = {}) {
    return createWorker(queueNames.appleMusicWebhook, async (job) => {
        await worker.process(job.data);
    }, { concurrency: options.concurrency });
}
export function registerAppleMusicHealthWorker(worker, options = {}) {
    return createWorker(queueNames.appleMusicHealth, async (job) => {
        await worker.process(job.data);
    }, { concurrency: options.concurrency });
}
