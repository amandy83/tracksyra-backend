import type { QueueLogger } from "../logging/queueLogger";

export class BullMQQueueLogger implements QueueLogger {
  debug(message: string, context?: Readonly<Record<string, unknown>>): void {
    console.debug("[queue]", message, context ?? {});
  }

  info(message: string, context?: Readonly<Record<string, unknown>>): void {
    console.info("[queue]", message, context ?? {});
  }

  warn(message: string, context?: Readonly<Record<string, unknown>>): void {
    console.warn("[queue]", message, context ?? {});
  }

  error(message: string, context?: Readonly<Record<string, unknown>>): void {
    console.error("[queue]", message, context ?? {});
  }
}
