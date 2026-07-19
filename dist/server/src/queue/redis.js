import IORedis from "ioredis";
import { loadRuntimeEnv } from "../config/envLoader.js";
import { incrementMetric, setMetric } from "./metrics.js";
import { logger as rootLogger } from "../observability/logger.js";
let redisConnection = null;
let redisAvailable = null;
let redisHealthSnapshot = createRedisHealthSnapshot({
    provider: "redis",
    state: "unknown",
    healthy: false,
    connectionStatus: "unknown",
    checkedAt: null,
    lastSuccessAt: null,
    lastError: null,
    pingLatencyMs: null,
    infoLatencyMs: null,
    redisUrl: null,
    redisConnectionSource: "unconfigured",
    redisTls: false,
});
let redisHealthRefreshPromise = null;
export function readQueueEnvironment() {
    loadRuntimeEnv();
    const env = getProcessEnv();
    const nodeEnv = env.NODE_ENV || "development";
    const redis = readRedisConfiguration();
    const workerConcurrency = Number(env.WORKER_CONCURRENCY || 5);
    return {
        redisUrl: redis.redisUrl ?? undefined,
        redisConfigured: redis.redisConfigured,
        redisConnectionSource: redis.source,
        redisConnectTimeoutMs: redis.connectTimeoutMs,
        redisCommandTimeoutMs: redis.commandTimeoutMs,
        redisTls: redis.tls,
        queuePrefix: env.QUEUE_PREFIX || "tracksyra",
        workerConcurrency: Number.isFinite(workerConcurrency) && workerConcurrency > 0 ? workerConcurrency : 5,
        metricsEnabled: env.QUEUE_METRICS_ENABLED !== "false",
        nodeEnv,
        redisRequired: nodeEnv === "production",
    };
}
export function validateQueueEnvironment() {
    const config = readQueueEnvironment();
    if (config.redisRequired && !config.redisConfigured) {
        throw new Error("Redis configuration is required when NODE_ENV=production. Set REDIS_URL or REDIS_HOST/REDIS_PORT.");
    }
    return config;
}
export function isRedisQueueEnabled() {
    const config = validateQueueEnvironment();
    return config.redisConfigured;
}
export function getRedisConnection() {
    const config = validateQueueEnvironment();
    if (!config.redisUrl) {
        throw new Error("Redis is not configured. Set REDIS_URL to enable BullMQ queues.");
    }
    if (redisConnection && !isClosedConnection(redisConnection)) {
        return redisConnection;
    }
    redisConnection = null;
    const parsedUrl = new URL(config.redisUrl);
    const options = {
        maxRetriesPerRequest: null,
        enableOfflineQueue: true,
        enableReadyCheck: true,
        lazyConnect: true,
        connectTimeout: config.redisConnectTimeoutMs,
        commandTimeout: config.redisCommandTimeoutMs,
        retryStrategy: (attempt) => Math.min(250 * 2 ** Math.max(attempt - 1, 0), 5000),
        reconnectOnError: (error) => {
            const message = error instanceof Error ? error.message : String(error);
            return /READONLY|LOADING|CLUSTERDOWN|ETIMEDOUT|ECONNRESET|EPIPE|Socket closed|Connection is closed/i.test(message);
        },
        keepAlive: 10_000,
        noDelay: true,
        ...(config.redisTls || parsedUrl.protocol === "rediss:" ? { tls: { servername: parsedUrl.hostname, rejectUnauthorized: true } } : {}),
    };
    redisConnection = new IORedis(config.redisUrl, options);
    redisAvailable = false;
    redisConnection.on("connect", () => {
        redisAvailable = false;
        updateRedisHealthSnapshot({ state: "connecting", connectionStatus: "connecting", lastError: null });
    });
    redisConnection.on("ready", () => {
        redisAvailable = true;
        updateRedisHealthSnapshot({
            state: "healthy",
            healthy: true,
            connectionStatus: "connected",
            lastSuccessAt: new Date().toISOString(),
            lastError: null,
        });
    });
    redisConnection.on("error", (error) => {
        redisAvailable = false;
        updateRedisHealthSnapshot({
            state: "degraded",
            healthy: false,
            connectionStatus: "disconnected",
            lastError: error instanceof Error ? error.message : String(error),
        });
        if (config.nodeEnv !== "test") {
            rootLogger.warn("redis connection error", {
                component: "queue-redis",
                error: error instanceof Error ? { message: error.message, stack: error.stack } : { message: String(error) },
                redisUrl: redactRedisUrl(config.redisUrl),
            });
        }
    });
    redisConnection.on("end", () => {
        redisAvailable = false;
        updateRedisHealthSnapshot({
            state: "unhealthy",
            healthy: false,
            connectionStatus: "disconnected",
            lastError: "connection ended",
        });
    });
    redisConnection.on("close", () => {
        redisAvailable = false;
        updateRedisHealthSnapshot({
            state: "degraded",
            healthy: false,
            connectionStatus: "disconnected",
            lastError: "connection closed",
        });
    });
    redisConnection.on("reconnecting", () => {
        redisAvailable = false;
        incrementMetric("tracksyra_redis_reconnects_total");
        updateRedisHealthSnapshot({
            state: "connecting",
            healthy: false,
            connectionStatus: "connecting",
            lastError: null,
        });
    });
    return redisConnection;
}
export async function checkRedisHealth() {
    if (!isRedisQueueEnabled()) {
        updateRedisHealthSnapshot({
            state: "unhealthy",
            healthy: false,
            connectionStatus: "unknown",
            lastError: "Redis configuration missing",
        });
        return false;
    }
    try {
        const snapshot = await refreshRedisHealthSnapshot({ force: true });
        return snapshot.healthy;
    }
    catch (error) {
        redisAvailable = false;
        updateRedisHealthSnapshot({
            state: "degraded",
            healthy: false,
            connectionStatus: "disconnected",
            lastError: error instanceof Error ? error.message : String(error),
        });
        rootLogger.warn("redis unavailable; continuing with cached state", {
            component: "queue-redis",
            error: error instanceof Error ? { message: error.message, stack: error.stack } : { message: String(error) },
        });
        return false;
    }
}
export function getRedisAvailability() {
    return redisAvailable === true;
}
export function getRedisHealthSnapshot() {
    const ageMs = redisHealthSnapshot.checkedAt ? Math.max(Date.now() - Date.parse(redisHealthSnapshot.checkedAt), 0) : Number.POSITIVE_INFINITY;
    if (redisHealthSnapshot.connectionStatus !== "connected" && !redisHealthRefreshPromise) {
        void refreshRedisHealthSnapshot({ background: true }).catch((error) => {
            rootLogger.warn("redis health refresh failed", {
                component: "queue-redis",
                error: error instanceof Error ? { message: error.message, stack: error.stack } : { message: String(error) },
            });
        });
    }
    else if (ageMs > 15_000 && !redisHealthRefreshPromise) {
        void refreshRedisHealthSnapshot({ background: true }).catch((error) => {
            rootLogger.warn("redis health refresh failed", {
                component: "queue-redis",
                error: error instanceof Error ? { message: error.message, stack: error.stack } : { message: String(error) },
            });
        });
    }
    return {
        ...redisHealthSnapshot,
        cacheAgeMs: Number.isFinite(ageMs) ? ageMs : 0,
    };
}
export async function refreshRedisHealthSnapshot(options = {}) {
    if (!options.force && redisHealthRefreshPromise)
        return redisHealthRefreshPromise;
    if (redisHealthRefreshPromise)
        return redisHealthRefreshPromise;
    redisHealthRefreshPromise = (async () => {
        const config = validateQueueEnvironment();
        if (!config.redisConfigured || !config.redisUrl) {
            const snapshot = createRedisHealthSnapshot({
                provider: "redis",
                state: "unhealthy",
                healthy: false,
                connectionStatus: "unknown",
                checkedAt: new Date().toISOString(),
                lastSuccessAt: redisHealthSnapshot.lastSuccessAt,
                lastError: "Redis configuration missing",
                pingLatencyMs: null,
                infoLatencyMs: null,
                redisUrl: null,
                redisConnectionSource: "unconfigured",
                redisTls: false,
            });
            redisHealthSnapshot = snapshot;
            updateRedisMetrics(snapshot);
            return snapshot;
        }
        const redis = getRedisConnection();
        if (redis.status === "wait" || redis.status === "connecting") {
            await redis.connect();
        }
        const startedAt = Date.now();
        try {
            const pingStarted = Date.now();
            await redis.ping();
            const pingLatencyMs = Date.now() - pingStarted;
            const infoStarted = Date.now();
            await redis.info("server");
            const infoLatencyMs = Date.now() - infoStarted;
            const snapshot = createRedisHealthSnapshot({
                provider: "redis",
                state: "healthy",
                healthy: true,
                connectionStatus: "connected",
                checkedAt: new Date().toISOString(),
                lastSuccessAt: new Date().toISOString(),
                lastError: null,
                pingLatencyMs,
                infoLatencyMs,
                redisUrl: config.redisUrl ?? null,
                redisConnectionSource: config.redisConnectionSource,
                redisTls: config.redisTls,
            });
            redisAvailable = true;
            redisHealthSnapshot = snapshot;
            updateRedisMetrics(snapshot);
            rootLogger.info("redis health verified", {
                component: "queue-redis",
                latencyMs: Date.now() - startedAt,
                redisUrl: redactRedisUrl(config.redisUrl),
                source: config.redisConnectionSource,
            });
            return snapshot;
        }
        catch (error) {
            const snapshot = createRedisHealthSnapshot({
                provider: "redis",
                state: "degraded",
                healthy: false,
                connectionStatus: "disconnected",
                checkedAt: new Date().toISOString(),
                lastSuccessAt: redisHealthSnapshot.lastSuccessAt,
                lastError: error instanceof Error ? error.message : String(error),
                pingLatencyMs: null,
                infoLatencyMs: null,
                redisUrl: config.redisUrl ?? null,
                redisConnectionSource: config.redisConnectionSource,
                redisTls: config.redisTls,
            });
            redisAvailable = false;
            redisHealthSnapshot = snapshot;
            updateRedisMetrics(snapshot);
            if (config.nodeEnv !== "test") {
                rootLogger.warn("redis health verification failed", {
                    component: "queue-redis",
                    error: error instanceof Error ? { message: error.message, stack: error.stack } : { message: String(error) },
                    redisUrl: redactRedisUrl(config.redisUrl),
                    source: config.redisConnectionSource,
                });
            }
            return snapshot;
        }
    })();
    try {
        return await redisHealthRefreshPromise;
    }
    finally {
        if (!options.background)
            redisHealthRefreshPromise = null;
        else
            queueMicrotask(() => {
                redisHealthRefreshPromise = null;
            });
    }
}
export async function closeRedisConnection() {
    if (!redisConnection)
        return;
    const connection = redisConnection;
    redisConnection = null;
    redisAvailable = null;
    updateRedisHealthSnapshot({
        state: "unhealthy",
        healthy: false,
        connectionStatus: "disconnected",
        lastError: "connection closed",
    });
    await connection.quit().catch(() => connection.disconnect());
}
function getProcessEnv() {
    return process.env;
}
function isClosedConnection(connection) {
    return connection.status === "close" || connection.status === "end";
}
function readRedisConfiguration() {
    const env = getProcessEnv();
    const connectTimeoutMs = normalizeTimeout(env.REDIS_CONNECT_TIMEOUT_MS, 5_000);
    const commandTimeoutMs = normalizeTimeout(env.REDIS_COMMAND_TIMEOUT_MS, 30_000);
    const tls = isTruthy(env.REDIS_TLS);
    const redisDb = normalizeDatabaseIndex(env.REDIS_DB);
    const fromUrl = env.REDIS_URL?.trim();
    if (fromUrl) {
        const parsed = new URL(fromUrl);
        const normalized = new URL(parsed.toString());
        const source = "redis-url";
        return {
            redisUrl: normalized.toString(),
            redisConfigured: true,
            source,
            tls: parsed.protocol === "rediss:" || tls,
            connectTimeoutMs,
            commandTimeoutMs,
            host: parsed.hostname,
            port: Number(parsed.port || 6379),
            username: parsed.username || null,
            password: parsed.password || null,
            db: parsed.pathname ? Number(parsed.pathname.replace("/", "")) || 0 : 0,
        };
    }
    const host = env.REDIS_HOST?.trim();
    const port = normalizePort(env.REDIS_PORT);
    const username = env.REDIS_USERNAME?.trim() || null;
    const password = env.REDIS_PASSWORD?.trim() || null;
    if (host && port) {
        const source = "redis-host-port";
        const scheme = tls ? "rediss" : "redis";
        const auth = username ? `${encodeURIComponent(username)}${password ? `:${encodeURIComponent(password)}` : ""}@` : "";
        return {
            redisUrl: `${scheme}://${auth}${host}:${port}/${redisDb}`,
            redisConfigured: true,
            source,
            tls,
            connectTimeoutMs,
            commandTimeoutMs,
            host,
            port,
            username,
            password,
            db: redisDb,
        };
    }
    return {
        redisUrl: null,
        redisConfigured: false,
        source: "unconfigured",
        tls: false,
        connectTimeoutMs,
        commandTimeoutMs,
        host: null,
        port: null,
        username: null,
        password: null,
        db: 0,
    };
}
function normalizePort(value) {
    const port = Number(value);
    if (!Number.isFinite(port) || port <= 0)
        return null;
    return Math.trunc(port);
}
function normalizeTimeout(value, fallback) {
    const timeout = Number(value);
    if (!Number.isFinite(timeout) || timeout <= 0)
        return fallback;
    return Math.trunc(timeout);
}
function normalizeDatabaseIndex(value) {
    const index = Number(value);
    if (!Number.isFinite(index) || index < 0)
        return 0;
    return Math.trunc(index);
}
function isTruthy(value) {
    return ["1", "true", "yes", "on"].includes(String(value ?? "").toLowerCase());
}
function createRedisHealthSnapshot(snapshot) {
    return {
        ...snapshot,
        cacheAgeMs: snapshot.cacheAgeMs ?? 0,
    };
}
function updateRedisHealthSnapshot(partial) {
    redisHealthSnapshot = createRedisHealthSnapshot({
        provider: "redis",
        state: partial.state !== undefined ? partial.state : redisHealthSnapshot.state,
        healthy: partial.healthy !== undefined ? partial.healthy : redisHealthSnapshot.healthy,
        connectionStatus: partial.connectionStatus !== undefined ? partial.connectionStatus : redisHealthSnapshot.connectionStatus,
        checkedAt: partial.checkedAt !== undefined ? partial.checkedAt : new Date().toISOString(),
        lastSuccessAt: partial.lastSuccessAt !== undefined ? partial.lastSuccessAt : redisHealthSnapshot.lastSuccessAt,
        lastError: partial.lastError !== undefined ? partial.lastError : redisHealthSnapshot.lastError,
        pingLatencyMs: partial.pingLatencyMs !== undefined ? partial.pingLatencyMs : redisHealthSnapshot.pingLatencyMs,
        infoLatencyMs: partial.infoLatencyMs !== undefined ? partial.infoLatencyMs : redisHealthSnapshot.infoLatencyMs,
        redisUrl: partial.redisUrl !== undefined ? partial.redisUrl : redisHealthSnapshot.redisUrl,
        redisConnectionSource: partial.redisConnectionSource !== undefined ? partial.redisConnectionSource : redisHealthSnapshot.redisConnectionSource,
        redisTls: partial.redisTls !== undefined ? partial.redisTls : redisHealthSnapshot.redisTls,
    });
    updateRedisMetrics(redisHealthSnapshot);
}
function updateRedisMetrics(snapshot) {
    setMetric("tracksyra_redis_connection_state", { state: snapshot.state, source: snapshot.redisConnectionSource }, snapshot.healthy ? 1 : 0);
    setMetric("tracksyra_redis_connection_age_ms", { source: snapshot.redisConnectionSource }, snapshot.cacheAgeMs);
    if (typeof snapshot.pingLatencyMs === "number")
        setMetric("tracksyra_redis_ping_latency_ms", { source: snapshot.redisConnectionSource }, snapshot.pingLatencyMs);
    if (typeof snapshot.infoLatencyMs === "number")
        setMetric("tracksyra_redis_info_latency_ms", { source: snapshot.redisConnectionSource }, snapshot.infoLatencyMs);
    incrementMetric("tracksyra_redis_health_checks_total", { source: snapshot.redisConnectionSource, healthy: String(snapshot.healthy) });
}
function redactRedisUrl(redisUrl) {
    if (!redisUrl)
        return null;
    try {
        const parsed = new URL(redisUrl);
        if (parsed.password)
            parsed.password = "[REDACTED]";
        if (parsed.username)
            parsed.username = parsed.username ? "[REDACTED]" : "";
        return parsed.toString();
    }
    catch {
        return "[REDACTED]";
    }
}
