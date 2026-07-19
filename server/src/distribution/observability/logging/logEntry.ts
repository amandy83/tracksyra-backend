import type { ObservabilityMetadata } from "../types/observabilityTypes";

export class LogEntry {
  readonly logId: string;
  readonly level: "debug" | "info" | "warn" | "error";
  readonly message: string;
  readonly source: string;
  readonly occurredAt: string;
  readonly traceId: string | null;
  readonly spanId: string | null;
  readonly metadata: ObservabilityMetadata;

  constructor(input: {
    logId: string;
    level: "debug" | "info" | "warn" | "error";
    message: string;
    source: string;
    occurredAt?: string;
    traceId?: string | null;
    spanId?: string | null;
    metadata?: ObservabilityMetadata;
  }) {
    this.logId = input.logId.trim();
    this.level = input.level;
    this.message = input.message.trim();
    this.source = input.source.trim();
    this.occurredAt = input.occurredAt ?? new Date().toISOString();
    this.traceId = input.traceId ?? null;
    this.spanId = input.spanId ?? null;
    this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
    if (!this.logId || !this.message || !this.source) {
      throw new Error("LogEntry requires logId, message, and source");
    }
    Object.freeze(this);
  }
}

