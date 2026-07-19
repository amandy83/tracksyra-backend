export class ConsoleMetadataLogger {
    defaults;
    constructor(defaults = {}) {
        this.defaults = defaults;
    }
    child(context) {
        return createConsoleMetadataLogger({ ...this.defaults, ...context });
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
        const entry = JSON.stringify({
            timestamp: new Date().toISOString(),
            level,
            message,
            ...this.defaults,
            ...context,
        });
        if (level === "error")
            console.error(entry);
        else if (level === "warn")
            console.warn(entry);
        else
            console.log(entry);
    }
}
export function createConsoleMetadataLogger(defaults = {}) {
    return {
        child(context) {
            return createConsoleMetadataLogger({ ...defaults, ...context });
        },
        debug(message, context = {}) {
            writeMetadataLog(defaults, "debug", message, context);
        },
        info(message, context = {}) {
            writeMetadataLog(defaults, "info", message, context);
        },
        warn(message, context = {}) {
            writeMetadataLog(defaults, "warn", message, context);
        },
        error(message, context = {}) {
            writeMetadataLog(defaults, "error", message, context);
        },
    };
}
function writeMetadataLog(defaults, level, message, context) {
    const entry = JSON.stringify({
        timestamp: new Date().toISOString(),
        level,
        message,
        ...defaults,
        ...context,
    });
    if (level === "error")
        console.error(entry);
    else if (level === "warn")
        console.warn(entry);
    else
        console.log(entry);
}
