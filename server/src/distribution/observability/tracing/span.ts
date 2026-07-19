import type { ObservabilityMetadata, TraceCategory } from "../types/observabilityTypes";

export class Span {
  readonly spanId: string;
  readonly traceId: string;
  readonly parentSpanId: string | null;
  readonly category: TraceCategory;
  readonly name: string;
  readonly startedAt: string;
  readonly endedAt: string | null;
  readonly durationMs: number | null;
  readonly metadata: ObservabilityMetadata;

  constructor(input: {
    spanId: string;
    traceId: string;
    parentSpanId?: string | null;
    category: TraceCategory;
    name: string;
    startedAt?: string;
    endedAt?: string | null;
    durationMs?: number | null;
    metadata?: ObservabilityMetadata;
  }) {
    this.spanId = input.spanId.trim();
    this.traceId = input.traceId.trim();
    this.parentSpanId = input.parentSpanId ?? null;
    this.category = input.category;
    this.name = input.name.trim();
    this.startedAt = input.startedAt ?? new Date().toISOString();
    this.endedAt = input.endedAt ?? null;
    this.durationMs = input.durationMs ?? null;
    this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
    if (!this.spanId || !this.traceId || !this.name) {
      throw new Error("Span requires spanId, traceId, and name");
    }
    Object.freeze(this);
  }
}

