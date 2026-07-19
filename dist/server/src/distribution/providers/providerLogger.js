export class ConsoleProviderLogger {
    defaults;
    constructor(defaults = {}) {
        this.defaults = defaults;
    }
    child(context) {
        return createConsoleProviderLogger({ ...this.defaults, ...context });
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
        const entry = JSON.stringify(sanitize({
            timestamp: new Date().toISOString(),
            level,
            message,
            ...this.defaults,
            ...context,
        }));
        if (level === "error")
            console.error(entry);
        else if (level === "warn")
            console.warn(entry);
        else
            console.log(entry);
    }
}
export function createConsoleProviderLogger(defaults = {}) {
    return {
        child(context) {
            return createConsoleProviderLogger({ ...defaults, ...context });
        },
        debug(message, context = {}) {
            writeProviderLog(defaults, "debug", message, context);
        },
        info(message, context = {}) {
            writeProviderLog(defaults, "info", message, context);
        },
        warn(message, context = {}) {
            writeProviderLog(defaults, "warn", message, context);
        },
        error(message, context = {}) {
            writeProviderLog(defaults, "error", message, context);
        },
    };
}
function writeProviderLog(defaults, level, message, context) {
    const entry = JSON.stringify(sanitize({
        timestamp: new Date().toISOString(),
        level,
        message,
        ...defaults,
        ...context,
    }));
    if (level === "error")
        console.error(entry);
    else if (level === "warn")
        console.warn(entry);
    else
        console.log(entry);
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
