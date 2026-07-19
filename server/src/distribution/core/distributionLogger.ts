export type DistributionLogLevel = "debug" | "info" | "warn" | "error";

export type DistributionLogContext = Record<string, unknown>;

export interface DistributionLogger {
  debug(message: string, context?: DistributionLogContext): void;
  info(message: string, context?: DistributionLogContext): void;
  warn(message: string, context?: DistributionLogContext): void;
  error(message: string, context?: DistributionLogContext): void;
  child?(context: DistributionLogContext): DistributionLogger;
}

export class ConsoleDistributionLogger implements DistributionLogger {
  constructor(private readonly defaults: DistributionLogContext = {}) {}

  child(context: DistributionLogContext): DistributionLogger {
    return createConsoleDistributionLogger({ ...this.defaults, ...context });
  }

  debug(message: string, context: DistributionLogContext = {}): void {
    this.write("debug", message, context);
  }

  info(message: string, context: DistributionLogContext = {}): void {
    this.write("info", message, context);
  }

  warn(message: string, context: DistributionLogContext = {}): void {
    this.write("warn", message, context);
  }

  error(message: string, context: DistributionLogContext = {}): void {
    this.write("error", message, context);
  }

  private write(level: DistributionLogLevel, message: string, context: DistributionLogContext): void {
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...this.defaults,
      ...context,
    };

    const serialized = JSON.stringify(sanitize(entry));
    if (level === "error") console.error(serialized);
    else if (level === "warn") console.warn(serialized);
    else console.log(serialized);
  }
}

export function createConsoleDistributionLogger(defaults: DistributionLogContext = {}): DistributionLogger {
  return {
    child(context: DistributionLogContext): DistributionLogger {
      return createConsoleDistributionLogger({ ...defaults, ...context });
    },
    debug(message: string, context: DistributionLogContext = {}): void {
      writeDistributionLog(defaults, "debug", message, context);
    },
    info(message: string, context: DistributionLogContext = {}): void {
      writeDistributionLog(defaults, "info", message, context);
    },
    warn(message: string, context: DistributionLogContext = {}): void {
      writeDistributionLog(defaults, "warn", message, context);
    },
    error(message: string, context: DistributionLogContext = {}): void {
      writeDistributionLog(defaults, "error", message, context);
    },
  };
}

function writeDistributionLog(defaults: DistributionLogContext, level: DistributionLogLevel, message: string, context: DistributionLogContext): void {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...defaults,
    ...context,
  };

  const serialized = JSON.stringify(sanitize(entry));
  if (level === "error") console.error(serialized);
  else if (level === "warn") console.warn(serialized);
  else console.log(serialized);
}

function sanitize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitize);
  if (!value || typeof value !== "object") return value;

  const blocked = new Set(["password", "token", "secret", "authorization", "api_key", "access_token", "refresh_token"]);
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
      key,
      blocked.has(key.toLowerCase()) ? "[REDACTED]" : sanitize(entry),
    ]),
  );
}
