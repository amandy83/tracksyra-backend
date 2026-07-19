import { getRedisConnection, readQueueEnvironment } from "../../../../queue/redis.js";
import { QueueConfiguration } from "../types/queueIntegrationTypes.js";
export function createBullMQQueueConfiguration(queueName, metadata = {}) {
    const env = readQueueEnvironment();
    return new QueueConfiguration({
        configurationId: `${queueName}:bullmq`,
        adapter: "BullMQ",
        queueName,
        namespace: env.queuePrefix,
        region: null,
        enabled: true,
        retryPolicy: "Exponential",
        leaseDurationMs: 60_000,
        heartbeatIntervalMs: 15_000,
        pollIntervalMs: 5_000,
        concurrency: env.workerConcurrency,
        metadata,
    });
}
export function resolveBullMQConnection() {
    return getRedisConnection();
}
export function resolveBullMQPriority(envelope) {
    const priority = normalizePriority(envelope.attributes.priority ?? envelope.metadata.priority ?? envelope.metadata.queuePriority);
    switch (priority) {
        case "Critical":
            return 1;
        case "High":
            return 10;
        case "Low":
            return 90;
        case "Background":
            return 100;
        default:
            return 50;
    }
}
export function resolveBullMQDelay(envelope) {
    if (typeof envelope.attributes.delayMs === "number" && Number.isFinite(envelope.attributes.delayMs)) {
        return Math.max(Math.trunc(envelope.attributes.delayMs), 0);
    }
    if (typeof envelope.scheduledAt === "string" && envelope.scheduledAt) {
        const scheduled = Date.parse(envelope.scheduledAt);
        if (Number.isFinite(scheduled)) {
            return Math.max(scheduled - Date.now(), 0);
        }
    }
    return 0;
}
export function resolveBullMQJobId(envelope) {
    const value = envelope.attributes.idempotencyKey ?? envelope.metadata.idempotencyKey ?? envelope.messageId;
    return String(value).replace(/:/g, "__");
}
export function resolveBullMQAttempts(envelope) {
    return Math.max(envelope.retryContext?.maxAttempts ?? 3, 1);
}
export function resolveBullMQBackoff(envelope) {
    const policy = envelope.retryContext?.policy ?? "Exponential";
    const baseDelay = 1_000;
    switch (policy) {
        case "Immediate":
            return undefined;
        case "Linear":
            return { type: "fixed", delay: baseDelay };
        case "Exponential":
            return { type: "exponential", delay: baseDelay };
        case "ExponentialWithJitter":
            return { type: "exponential", delay: baseDelay + Math.floor(Math.random() * 250) };
        case "ManualOnly":
        case "NeverRetry":
            return undefined;
        default:
            return { type: "exponential", delay: baseDelay };
    }
}
function normalizePriority(value) {
    if (typeof value === "string") {
        const normalized = value.trim().toLowerCase();
        if (normalized === "critical")
            return "Critical";
        if (normalized === "high")
            return "High";
        if (normalized === "low")
            return "Low";
        if (normalized === "background")
            return "Background";
    }
    return "Normal";
}
