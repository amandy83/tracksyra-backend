export class DefaultStorageLogger {
    logger;
    constructor(logger = null) {
        this.logger = logger;
    }
    debug(message, context) { this.logger?.debug(message, context); }
    info(message, context) { this.logger?.info(message, context); }
    warn(message, context) { this.logger?.warn(message, context); }
    error(message, context) { this.logger?.error(message, context); }
}
