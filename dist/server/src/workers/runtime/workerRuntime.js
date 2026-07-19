import { closeQueues, getQueueMetrics, pauseQueue, resumeQueue } from "../../queue/queueFactory.js";
import { closeRedisConnection, checkRedisHealth, getRedisHealthSnapshot } from "../../queue/redis.js";
import { toPrometheusMetrics } from "../../queue/metrics.js";
import { queueNames } from "../../queue/queueNames.js";
import { assertProductionEnvironment, validateProductionEnvironment } from "../../config/environmentValidation.js";
import { logRuntimeEnv } from "../../config/envLoader.js";
import { validateEmailQueueSchema } from "../../notifications/emailQueue.js";
import { JobScheduler } from "bullmq";
import { createQueueEvents, createScheduler } from "../../queue/queueFactory.js";
export class WorkerRuntime {
    logger;
    supervisor;
    queueEnvironment;
    registrations = [];
    heartbeatTimer = null;
    shuttingDown = false;
    constructor(logger, supervisor, queueEnvironment) {
        this.logger = logger;
        this.supervisor = supervisor;
        this.queueEnvironment = queueEnvironment;
    }
    async startupHealthCheck() {
        logRuntimeEnv("worker-runtime");
        const validation = validateProductionEnvironment();
        for (const warning of validation.warnings)
            this.logger.warn("environment validation warning", { component: "worker-runtime", warning });
        assertProductionEnvironment();
        const emailSchema = await validateEmailQueueSchema();
        if (!emailSchema.ok) {
            this.logger.warn("email queue schema validation failed", { component: "worker-runtime", tables: emailSchema.tables });
        }
        const redisHealthy = await checkRedisHealth();
        const redisHealth = getRedisHealthSnapshot();
        this.logger.info("redis startup verification complete", {
            component: "worker-runtime",
            healthy: redisHealthy,
            state: redisHealth.state,
            connectionStatus: redisHealth.connectionStatus,
            cacheAgeMs: redisHealth.cacheAgeMs,
        });
        return redisHealthy;
    }
    register(registration) {
        this.registrations.push(registration);
        this.supervisor.register(registration);
        this.logger.info("worker registered", { component: "worker-runtime", worker: registration.name });
        return registration;
    }
    startHeartbeat(intervalMs = 30000) {
        if (this.heartbeatTimer)
            return;
        this.supervisor.start();
        this.heartbeatTimer = setInterval(() => {
            this.logger.info("runtime heartbeat", {
                component: "worker-runtime",
                workers: this.registrations.length,
                redis: this.queueEnvironment().redisConfigured ? "configured" : "missing",
                redisState: getRedisHealthSnapshot().state,
                memory: getProcessMemory(),
            });
        }, intervalMs);
    }
    installSignalHandlers() {
        const processRef = process;
        if (!processRef?.once)
            return;
        const shutdown = async (signal) => {
            await this.shutdown();
            processRef.exit(signal === "SIGINT" ? 130 : 143);
        };
        processRef.once("SIGINT", () => void shutdown("SIGINT"));
        processRef.once("SIGTERM", () => void shutdown("SIGTERM"));
    }
    async collectMetrics() {
        return Promise.all(productionQueueNames.map((name) => getQueueMetrics(name)));
    }
    async prometheusMetrics() {
        return toPrometheusMetrics(await this.collectMetrics());
    }
    async pauseAll() {
        await Promise.all(this.registrations.map((registration) => registration.worker.pause?.()));
        await Promise.all(queueList().map((name) => pauseQueue(name)));
        this.logger.warn("all queues paused", { component: "worker-runtime" });
    }
    async resumeAll() {
        await Promise.all(queueList().map((name) => resumeQueue(name)));
        await Promise.all(this.registrations.map((registration) => registration.worker.resume?.()));
        this.logger.info("all queues resumed", { component: "worker-runtime" });
    }
    async shutdown() {
        if (this.shuttingDown)
            return;
        this.shuttingDown = true;
        if (this.heartbeatTimer)
            clearInterval(this.heartbeatTimer);
        this.heartbeatTimer = null;
        await this.supervisor.stop();
        await Promise.all(this.registrations.map((registration) => registration.shutdown?.()));
        await Promise.all(this.registrations.map((registration) => registration.worker.close()));
        this.registrations = [];
        await closeQueues();
        await closeRedisConnection();
        this.logger.info("worker runtime shutdown complete", { component: "worker-runtime" });
    }
}
export function createQueueSchedulers() {
    return productionQueueNames
        .map((queueName) => {
        const scheduler = createScheduler(queueName, (name, options) => new JobScheduler(name, options));
        createQueueEvents(queueName);
        return scheduler;
    })
        .filter((scheduler) => Boolean(scheduler));
}
const productionQueueNames = [
    queueNames.email,
    queueNames.distribution,
    queueNames.royalty,
    queueNames.fraud,
    queueNames.analytics,
    queueNames.realtime,
    queueNames.payout,
    queueNames.mediaProcessing,
    queueNames.artworkProcessing,
    queueNames.waveformGeneration,
    queueNames.fingerprintAnalysis,
];
function queueList() {
    return [
        queueNames.backup,
        queueNames.incrementalBackup,
        queueNames.restore,
        queueNames.backupVerification,
        queueNames.recoveryAudit,
        queueNames.email,
        queueNames.distribution,
        queueNames.review,
        queueNames.fraudReview,
        queueNames.delivery,
        queueNames.retry,
        queueNames.withdrawal,
        queueNames.takedown,
        queueNames.spotifyDelivery,
        queueNames.spotifyPolling,
        queueNames.spotifyRetry,
        queueNames.spotifyWebhook,
        queueNames.spotifyHealth,
        queueNames.amazonMusicDelivery,
        queueNames.amazonMusicPolling,
        queueNames.amazonMusicRetry,
        queueNames.amazonMusicWebhook,
        queueNames.amazonMusicHealth,
        queueNames.deezerDelivery,
        queueNames.deezerPolling,
        queueNames.deezerRetry,
        queueNames.deezerWebhook,
        queueNames.deezerHealth,
        queueNames.tidalDelivery,
        queueNames.tidalPolling,
        queueNames.tidalRetry,
        queueNames.tidalWebhook,
        queueNames.tidalHealth,
        queueNames.jioSaavnDelivery,
        queueNames.jioSaavnPolling,
        queueNames.jioSaavnRetry,
        queueNames.jioSaavnWebhook,
        queueNames.jioSaavnHealth,
        queueNames.anghamiDelivery,
        queueNames.anghamiPolling,
        queueNames.anghamiRetry,
        queueNames.anghamiWebhook,
        queueNames.anghamiHealth,
        queueNames.boomplayDelivery,
        queueNames.boomplayPolling,
        queueNames.boomplayRetry,
        queueNames.boomplayWebhook,
        queueNames.boomplayHealth,
        queueNames.tiktokDelivery,
        queueNames.tiktokPolling,
        queueNames.tiktokRetry,
        queueNames.tiktokWebhook,
        queueNames.tiktokHealth,
        queueNames.metaDelivery,
        queueNames.metaPolling,
        queueNames.metaRetry,
        queueNames.metaWebhook,
        queueNames.metaHealth,
        queueNames.youtubeDelivery,
        queueNames.youtubePolling,
        queueNames.youtubeRetry,
        queueNames.youtubeWebhook,
        queueNames.youtubeHealth,
        queueNames.youtubeContentId,
        queueNames.appleMusicDelivery,
        queueNames.appleMusicPolling,
        queueNames.appleMusicRetry,
        queueNames.appleMusicWebhook,
        queueNames.appleMusicHealth,
        queueNames.metadataValidation,
        queueNames.metadataNormalization,
        queueNames.metadataRepair,
        queueNames.metadataRecommendation,
        queueNames.metadataAudit,
        queueNames.metadataRetry,
        queueNames.releaseScheduler,
        queueNames.deliveryOrchestration,
        queueNames.deliveryRetry,
        queueNames.rollback,
        queueNames.approval,
        queueNames.automation,
        queueNames.deliveryAudit,
        queueNames.deliveryWebhook,
        queueNames.deliveryHealth,
        queueNames.sla,
        queueNames.fingerprint,
        queueNames.duplicate,
        queueNames.similarity,
        queueNames.audioFraud,
        queueNames.fingerprintRetry,
        queueNames.fingerprintAudit,
        queueNames.audit,
        queueNames.validation,
        queueNames.royalty,
        queueNames.royaltyCalculation,
        queueNames.statement,
        queueNames.currency,
        queueNames.tax,
        queueNames.reserve,
        queueNames.adjustment,
        queueNames.payment,
        queueNames.forecast,
        queueNames.royaltyAudit,
        queueNames.royaltyRetry,
        queueNames.fraud,
        queueNames.rightsValidation,
        queueNames.rightsTerritorySync,
        queueNames.rightsConflictDetection,
        queueNames.rightsWithdrawal,
        queueNames.rightsLicenseExpiration,
        queueNames.rightsAudit,
        queueNames.analytics,
        queueNames.realtime,
        queueNames.payout,
        queueNames.mediaProcessing,
        queueNames.artworkProcessing,
        queueNames.waveformGeneration,
        queueNames.fingerprintAnalysis,
    ];
}
function getProcessMemory() {
    return process.memoryUsage?.() || {};
}
