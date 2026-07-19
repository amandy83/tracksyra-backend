import type { StructuredLogger } from "../logging/logging";

export interface StorageLogger {
  debug(message: string, context?: Readonly<Record<string, unknown>>): void;
  info(message: string, context?: Readonly<Record<string, unknown>>): void;
  warn(message: string, context?: Readonly<Record<string, unknown>>): void;
  error(message: string, context?: Readonly<Record<string, unknown>>): void;
}

export class DefaultStorageLogger implements StorageLogger {
  constructor(private readonly logger: StructuredLogger | null = null) {}

  debug(message: string, context?: Readonly<Record<string, unknown>>): void { this.logger?.debug(message, context); }
  info(message: string, context?: Readonly<Record<string, unknown>>): void { this.logger?.info(message, context); }
  warn(message: string, context?: Readonly<Record<string, unknown>>): void { this.logger?.warn(message, context); }
  error(message: string, context?: Readonly<Record<string, unknown>>): void { this.logger?.error(message, context); }
}
