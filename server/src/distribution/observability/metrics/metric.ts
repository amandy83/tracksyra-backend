import type { MetricCategory, ObservabilityMetadata } from "../types/observabilityTypes";

export class Metric {
  readonly metricId: string;
  readonly name: string;
  readonly category: MetricCategory;
  readonly value: number;
  readonly unit: string | null;
  readonly recordedAt: string;
  readonly tags: Readonly<Record<string, string | number | boolean>>;
  readonly metadata: ObservabilityMetadata;

  constructor(input: {
    metricId: string;
    name: string;
    category: MetricCategory;
    value: number;
    unit?: string | null;
    recordedAt?: string;
    tags?: Readonly<Record<string, string | number | boolean>>;
    metadata?: ObservabilityMetadata;
  }) {
    this.metricId = input.metricId.trim();
    this.name = input.name.trim();
    this.category = input.category;
    this.value = input.value;
    this.unit = input.unit ?? null;
    this.recordedAt = input.recordedAt ?? new Date().toISOString();
    this.tags = Object.freeze({ ...(input.tags ?? {}) });
    this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
    if (!this.metricId || !this.name) {
      throw new Error("Metric requires metricId and name");
    }
    if (!Number.isFinite(this.value)) {
      throw new Error("Metric.value must be finite");
    }
    Object.freeze(this);
  }
}

