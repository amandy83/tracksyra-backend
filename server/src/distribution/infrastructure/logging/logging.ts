export interface StructuredLogger {
  info(message: string, context?: Readonly<Record<string, unknown>>): void;
  warn(message: string, context?: Readonly<Record<string, unknown>>): void;
  error(message: string, context?: Readonly<Record<string, unknown>>): void;
  debug(message: string, context?: Readonly<Record<string, unknown>>): void;
}

export class ConsoleStructuredLogger implements StructuredLogger {
  info(message: string, context: Readonly<Record<string, unknown>> = {}): void { console.info(message, context); }
  warn(message: string, context: Readonly<Record<string, unknown>> = {}): void { console.warn(message, context); }
  error(message: string, context: Readonly<Record<string, unknown>> = {}): void { console.error(message, context); }
  debug(message: string, context: Readonly<Record<string, unknown>> = {}): void { console.debug(message, context); }
}

export class AuditLogger {
  constructor(private readonly logger: StructuredLogger) {}
  log(message: string, context: Readonly<Record<string, unknown>> = {}): void { this.logger.info(message, context); }
}

export class TimelineLogger {
  constructor(private readonly logger: StructuredLogger) {}
  log(message: string, context: Readonly<Record<string, unknown>> = {}): void { this.logger.info(message, context); }
}

