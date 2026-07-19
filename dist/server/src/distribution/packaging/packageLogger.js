export class ConsolePackageLogger {
    info(message, metadata = {}) {
        console.info(message, metadata);
    }
    warn(message, metadata = {}) {
        console.warn(message, metadata);
    }
    error(message, metadata = {}) {
        console.error(message, metadata);
    }
}
