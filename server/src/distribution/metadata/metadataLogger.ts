export type MetadataLogLevel = "debug" | "info" | "warn" | "error";

export type MetadataLogContext = Readonly<Record<string, unknown>>;

export interface MetadataLogger {
  debug(message: string, context?: MetadataLogContext): void;
  info(message: string, context?: MetadataLogContext): void;
  warn(message: string, context?: MetadataLogContext): void;
  error(message: string, context?: MetadataLogContext): void;
  child?(context: MetadataLogContext): MetadataLogger;
}

export class ConsoleMetadataLogger implements MetadataLogger {
  constructor(private readonly defaults: MetadataLogContext = {}) {}

  child(context: MetadataLogContext): MetadataLogger {
    return createConsoleMetadataLogger({ ...this.defaults, ...context });
  }

  debug(message: string, context: MetadataLogContext = {}): void {
    this.write("debug", message, context);
  }

  info(message: string, context: MetadataLogContext = {}): void {
    this.write("info", message, context);
  }

  warn(message: string, context: MetadataLogContext = {}): void {
    this.write("warn", message, context);
  }

  error(message: string, context: MetadataLogContext = {}): void {
    this.write("error", message, context);
  }

  private write(level: MetadataLogLevel, message: string, context: MetadataLogContext): void {
    const entry = JSON.stringify({
      timestamp: new Date().toISOString(),
      level,
      message,
      ...this.defaults,
      ...context,
    });
    if (level === "error") console.error(entry);
    else if (level === "warn") console.warn(entry);
    else console.log(entry);
  }
}

export function createConsoleMetadataLogger(defaults: MetadataLogContext = {}): MetadataLogger {
  return {
    child(context: MetadataLogContext): MetadataLogger {
      return createConsoleMetadataLogger({ ...defaults, ...context });
    },
    debug(message: string, context: MetadataLogContext = {}): void {
      writeMetadataLog(defaults, "debug", message, context);
    },
    info(message: string, context: MetadataLogContext = {}): void {
      writeMetadataLog(defaults, "info", message, context);
    },
    warn(message: string, context: MetadataLogContext = {}): void {
      writeMetadataLog(defaults, "warn", message, context);
    },
    error(message: string, context: MetadataLogContext = {}): void {
      writeMetadataLog(defaults, "error", message, context);
    },
  };
}

function writeMetadataLog(defaults: MetadataLogContext, level: MetadataLogLevel, message: string, context: MetadataLogContext): void {
  const entry = JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    message,
    ...defaults,
    ...context,
  });
  if (level === "error") console.error(entry);
  else if (level === "warn") console.warn(entry);
  else console.log(entry);
}
