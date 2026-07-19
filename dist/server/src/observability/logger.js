import { loadRuntimeEnv } from "../config/envLoader.js";
const levels = { debug: 10, info: 20, warn: 30, error: 40 };
export function createLogger(defaults = {}) {
    const write = (level, message, context) => {
        if (levels[level] < levels[getLogLevel()])
            return;
        const entry = sanitize({
            timestamp: new Date().toISOString(),
            level,
            message,
            ...defaults,
            ...context,
        });
        const line = JSON.stringify(entry);
        if (level === "error")
            console.error(line);
        else if (level === "warn")
            console.warn(line);
        else
            console.log(line);
    };
    const loggerImpl = {
        log(entry) {
            write(entry.level, entry.message, entry.context ?? {});
        },
        child(context) {
            return createLogger({ ...defaults, ...context });
        },
        debug(message, context = {}) {
            write("debug", message, context);
        },
        info(message, context = {}) {
            write("info", message, context);
        },
        warn(message, context = {}) {
            write("warn", message, context);
        },
        error(message, context = {}) {
            write("error", message, context);
        },
    };
    return loggerImpl;
}
export const logger = Object.assign((defaults = {}) => createLogger({ component: "tracksyra", ...defaults }), {
    log(entry) {
        createLogger({ component: "tracksyra" }).log(entry);
    },
    child(context) {
        return createLogger({ component: "tracksyra", ...context });
    },
    debug(message, context = {}) {
        createLogger({ component: "tracksyra" }).debug(message, context);
    },
    info(message, context = {}) {
        createLogger({ component: "tracksyra" }).info(message, context);
    },
    warn(message, context = {}) {
        createLogger({ component: "tracksyra" }).warn(message, context);
    },
    error(message, context = {}) {
        createLogger({ component: "tracksyra" }).error(message, context);
    },
});
export function serializeError(error) {
    if (error instanceof Error) {
        return { name: error.name, message: error.message, stack: error.stack };
    }
    return { message: String(error) };
}
function getLogLevel() {
    const value = readEnv("LOG_LEVEL");
    return value && value in levels ? value : readEnv("NODE_ENV") === "production" ? "info" : "debug";
}
function sanitize(value) {
    if (Array.isArray(value))
        return value.map(sanitize);
    if (!value || typeof value !== "object")
        return value;
    const blocked = new Set(["password", "token", "access_token", "refresh_token", "authorization", "api_key", "secret"]);
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [
        key,
        blocked.has(key.toLowerCase()) ? "[REDACTED]" : sanitize(entry),
    ]));
}
function readEnv(name) {
    loadRuntimeEnv();
    return process.env[name];
}
