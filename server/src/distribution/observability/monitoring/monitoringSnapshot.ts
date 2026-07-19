import type { ObservabilityMetadata } from "../types/observabilityTypes";

export class MonitoringSnapshot {
  readonly snapshotId: string;
  readonly capturedAt: string;
  readonly status: string;
  readonly summary: Readonly<Record<string, unknown>>;
  readonly metadata: ObservabilityMetadata;

  constructor(input: {
    snapshotId: string;
    capturedAt?: string;
    status: string;
    summary?: Readonly<Record<string, unknown>>;
    metadata?: ObservabilityMetadata;
  }) {
    this.snapshotId = input.snapshotId.trim();
    this.capturedAt = input.capturedAt ?? new Date().toISOString();
    this.status = input.status.trim();
    this.summary = Object.freeze({ ...(input.summary ?? {}) });
    this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
    if (!this.snapshotId || !this.status) {
      throw new Error("MonitoringSnapshot requires snapshotId and status");
    }
    Object.freeze(this);
  }
}

