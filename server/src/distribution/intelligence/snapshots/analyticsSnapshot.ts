import type { AnalyticsMetricName, ProjectionMetadata } from "../types/intelligenceTypes";

export class AnalyticsSnapshot {
  readonly releaseId: string;
  readonly generatedAt: string;
  readonly metrics: Readonly<Record<AnalyticsMetricName, number>>;
  readonly metadata: ProjectionMetadata;

  constructor(input: {
    releaseId: string;
    generatedAt?: string;
    metrics: Readonly<Record<AnalyticsMetricName, number>>;
    metadata?: ProjectionMetadata;
  }) {
    this.releaseId = input.releaseId.trim();
    this.generatedAt = input.generatedAt ?? new Date().toISOString();
    this.metrics = Object.freeze({ ...input.metrics });
    this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
    if (!this.releaseId) {
      throw new Error("AnalyticsSnapshot.releaseId must not be empty");
    }
    Object.freeze(this);
  }
}

