export class BullMQQueueLogger {
    debug(message, context) {
        console.debug("[queue]", message, context ?? {});
    }
    info(message, context) {
        console.info("[queue]", message, context ?? {});
    }
    warn(message, context) {
        console.warn("[queue]", message, context ?? {});
    }
    error(message, context) {
        console.error("[queue]", message, context ?? {});
    }
}
