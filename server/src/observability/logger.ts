import { loadRuntimeEnv } from "../config/envLoader";

export type LogLevel = "debug" | "info" | "warn" | "error";

export type LogContext = {
  traceId?: string | null;
  correlationId?: string | null;
  actorUserId?: string | null;
  component?: string;
  [key: string]: unknown;
};

const levels: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

export type Logger = Readonly<{
  log(entry: { level: LogLevel; message: string; context?: LogContext }): void;
  child(context: LogContext): Logger;
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, context?: LogContext): void;
}>;

export function createLogger(defaults: LogContext = {}) {
  const write = (level: LogLevel, message: string, context: LogContext) => {
    if (levels[level] < levels[getLogLevel()]) return;
    const entry = sanitize({
      timestamp: new Date().toISOString(),
      level,
      message,
      ...defaults,
      ...context,
    });
    const line = JSON.stringify(entry);
    if (level === "error") console.error(line);
    else if (level === "warn") console.warn(line);
    else console.log(line);
  };

  const loggerImpl: Logger = {
    log(entry: { level: LogLevel; message: string; context?: LogContext }) {
      write(entry.level, entry.message, entry.context ?? {});
    },
    child(context: LogContext) {
      return createLogger({ ...defaults, ...context });
    },
    debug(message: string, context: LogContext = {}) {
      write("debug", message, context);
    },
    info(message: string, context: LogContext = {}) {
      write("info", message, context);
    },
    warn(message: string, context: LogContext = {}) {
      write("warn", message, context);
    },
    error(message: string, context: LogContext = {}) {
      write("error", message, context);
    },
  };

  return loggerImpl;
}

type LoggerFactory = {
  (defaults?: LogContext): Logger;
  child(context: LogContext): Logger;
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, context?: LogContext): void;
};

export const logger: LoggerFactory = Object.assign(
  (defaults: LogContext = {}) => createLogger({ component: "tracksyra", ...defaults }),
  {
    log(entry: { level: LogLevel; message: string; context?: LogContext }) {
      createLogger({ component: "tracksyra" }).log(entry);
    },
    child(context: LogContext) {
      return createLogger({ component: "tracksyra", ...context });
    },
    debug(message: string, context: LogContext = {}) {
      createLogger({ component: "tracksyra" }).debug(message, context);
    },
    info(message: string, context: LogContext = {}) {
      createLogger({ component: "tracksyra" }).info(message, context);
    },
    warn(message: string, context: LogContext = {}) {
      createLogger({ component: "tracksyra" }).warn(message, context);
    },
    error(message: string, context: LogContext = {}) {
      createLogger({ component: "tracksyra" }).error(message, context);
    },
  },
);

export function serializeError(error: unknown) {
  if (error instanceof Error) {
    return { name: error.name, message: error.message, stack: error.stack };
  }
  return { message: String(error) };
}

function getLogLevel(): LogLevel {
  const value = readEnv("LOG_LEVEL") as LogLevel | undefined;
  return value && value in levels ? value : readEnv("NODE_ENV") === "production" ? "info" : "debug";
}

function sanitize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitize);
  if (!value || typeof value !== "object") return value;
  const blocked = new Set(["password", "token", "access_token", "refresh_token", "authorization", "api_key", "secret"]);
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
      key,
      blocked.has(key.toLowerCase()) ? "[REDACTED]" : sanitize(entry),
    ]),
  );
}

function readEnv(name: string) {
  loadRuntimeEnv();
  return process.env[name];
}
