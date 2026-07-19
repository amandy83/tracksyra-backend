export type ProviderLogLevel = "debug" | "info" | "warn" | "error";

export type ProviderLogContext = Readonly<Record<string, unknown>>;

export interface ProviderLogger {
  debug(message: string, context?: ProviderLogContext): void;
  info(message: string, context?: ProviderLogContext): void;
  warn(message: string, context?: ProviderLogContext): void;
  error(message: string, context?: ProviderLogContext): void;
  child?(context: ProviderLogContext): ProviderLogger;
}

export class ConsoleProviderLogger implements ProviderLogger {
  constructor(private readonly defaults: ProviderLogContext = {}) {}

  child(context: ProviderLogContext): ProviderLogger {
    return createConsoleProviderLogger({ ...this.defaults, ...context });
  }

  debug(message: string, context: ProviderLogContext = {}): void {
    this.write("debug", message, context);
  }

  info(message: string, context: ProviderLogContext = {}): void {
    this.write("info", message, context);
  }

  warn(message: string, context: ProviderLogContext = {}): void {
    this.write("warn", message, context);
  }

  error(message: string, context: ProviderLogContext = {}): void {
    this.write("error", message, context);
  }

  private write(level: ProviderLogLevel, message: string, context: ProviderLogContext): void {
    const entry = JSON.stringify(sanitize({
      timestamp: new Date().toISOString(),
      level,
      message,
      ...this.defaults,
      ...context,
    }));

    if (level === "error") console.error(entry);
    else if (level === "warn") console.warn(entry);
    else console.log(entry);
  }
}

export function createConsoleProviderLogger(defaults: ProviderLogContext = {}): ProviderLogger {
  return {
    child(context: ProviderLogContext): ProviderLogger {
      return createConsoleProviderLogger({ ...defaults, ...context });
    },
    debug(message: string, context: ProviderLogContext = {}): void {
      writeProviderLog(defaults, "debug", message, context);
    },
    info(message: string, context: ProviderLogContext = {}): void {
      writeProviderLog(defaults, "info", message, context);
    },
    warn(message: string, context: ProviderLogContext = {}): void {
      writeProviderLog(defaults, "warn", message, context);
    },
    error(message: string, context: ProviderLogContext = {}): void {
      writeProviderLog(defaults, "error", message, context);
    },
  };
}

function writeProviderLog(defaults: ProviderLogContext, level: ProviderLogLevel, message: string, context: ProviderLogContext): void {
  const entry = JSON.stringify(sanitize({
    timestamp: new Date().toISOString(),
    level,
    message,
    ...defaults,
    ...context,
  }));

  if (level === "error") console.error(entry);
  else if (level === "warn") console.warn(entry);
  else console.log(entry);
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
