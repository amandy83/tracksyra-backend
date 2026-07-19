import type { ObservabilityMetadata } from "../types/observabilityTypes";

export class PerformanceSnapshot {
  readonly snapshotId: string;
  readonly releaseId: string | null;
  readonly measuredAt: string;
  readonly latencies: Readonly<Record<string, number>>;
  readonly counts: Readonly<Record<string, number>>;
  readonly metadata: ObservabilityMetadata;

  constructor(input: {
    snapshotId: string;
    releaseId?: string | null;
    measuredAt?: string;
    latencies?: Readonly<Record<string, number>>;
    counts?: Readonly<Record<string, number>>;
    metadata?: ObservabilityMetadata;
  }) {
    this.snapshotId = input.snapshotId.trim();
    this.releaseId = input.releaseId ?? null;
    this.measuredAt = input.measuredAt ?? new Date().toISOString();
    this.latencies = Object.freeze({ ...(input.latencies ?? {}) });
    this.counts = Object.freeze({ ...(input.counts ?? {}) });
    this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
    if (!this.snapshotId) {
      throw new Error("PerformanceSnapshot.snapshotId must not be empty");
    }
    Object.freeze(this);
  }
}

