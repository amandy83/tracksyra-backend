export class ConsoleStructuredLogger {
    info(message, context = {}) { console.info(message, context); }
    warn(message, context = {}) { console.warn(message, context); }
    error(message, context = {}) { console.error(message, context); }
    debug(message, context = {}) { console.debug(message, context); }
}
export class AuditLogger {
    logger;
    constructor(logger) {
        this.logger = logger;
    }
    log(message, context = {}) { this.logger.info(message, context); }
}
export class TimelineLogger {
    logger;
    constructor(logger) {
        this.logger = logger;
    }
    log(message, context = {}) { this.logger.info(message, context); }
}
