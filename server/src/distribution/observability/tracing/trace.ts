import type { TraceCategory, ObservabilityMetadata } from "../types/observabilityTypes";
import { Span } from "./span";

export class Trace {
  readonly traceId: string;
  readonly rootSpanId: string | null;
  readonly category: TraceCategory;
  readonly name: string;
  readonly startedAt: string;
  readonly endedAt: string | null;
  readonly spans: readonly Span[];
  readonly metadata: ObservabilityMetadata;

  constructor(input: {
    traceId: string;
    category: TraceCategory;
    name: string;
    rootSpanId?: string | null;
    startedAt?: string;
    endedAt?: string | null;
    spans?: readonly Span[];
    metadata?: ObservabilityMetadata;
  }) {
    this.traceId = input.traceId.trim();
    this.category = input.category;
    this.name = input.name.trim();
    this.rootSpanId = input.rootSpanId ?? null;
    this.startedAt = input.startedAt ?? new Date().toISOString();
    this.endedAt = input.endedAt ?? null;
    this.spans = Object.freeze([...(input.spans ?? [])]);
    this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
    if (!this.traceId || !this.name) {
      throw new Error("Trace requires traceId and name");
    }
    Object.freeze(this);
  }
}

