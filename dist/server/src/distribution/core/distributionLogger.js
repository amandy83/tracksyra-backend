export class ConsoleDistributionLogger {
    defaults;
    constructor(defaults = {}) {
        this.defaults = defaults;
    }
    child(context) {
        return createConsoleDistributionLogger({ ...this.defaults, ...context });
    }
    debug(message, context = {}) {
        this.write("debug", message, context);
    }
    info(message, context = {}) {
        this.write("info", message, context);
    }
    warn(message, context = {}) {
        this.write("warn", message, context);
    }
    error(message, context = {}) {
        this.write("error", message, context);
    }
    write(level, message, context) {
        const entry = {
            timestamp: new Date().toISOString(),
            level,
            message,
            ...this.defaults,
            ...context,
        };
        const serialized = JSON.stringify(sanitize(entry));
        if (level === "error")
            console.error(serialized);
        else if (level === "warn")
            console.warn(serialized);
        else
            console.log(serialized);
    }
}
export function createConsoleDistributionLogger(defaults = {}) {
    return {
        child(context) {
            return createConsoleDistributionLogger({ ...defaults, ...context });
        },
        debug(message, context = {}) {
            writeDistributionLog(defaults, "debug", message, context);
        },
        info(message, context = {}) {
            writeDistributionLog(defaults, "info", message, context);
        },
        warn(message, context = {}) {
            writeDistributionLog(defaults, "warn", message, context);
        },
        error(message, context = {}) {
            writeDistributionLog(defaults, "error", message, context);
        },
    };
}
function writeDistributionLog(defaults, level, message, context) {
    const entry = {
        timestamp: new Date().toISOString(),
        level,
        message,
        ...defaults,
        ...context,
    };
    const serialized = JSON.stringify(sanitize(entry));
    if (level === "error")
        console.error(serialized);
    else if (level === "warn")
        console.warn(serialized);
    else
        console.log(serialized);
}
function sanitize(value) {
    if (Array.isArray(value))
        return value.map(sanitize);
    if (!value || typeof value !== "object")
        return value;
    const blocked = new Set(["password", "token", "secret", "authorization", "api_key", "access_token", "refresh_token"]);
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [
        key,
        blocked.has(key.toLowerCase()) ? "[REDACTED]" : sanitize(entry),
    ]));
}
