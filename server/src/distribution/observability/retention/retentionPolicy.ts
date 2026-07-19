import type { ObservabilityMetadata } from "../types/observabilityTypes";

export class RetentionPolicy {
  readonly policyId: string;
  readonly scope: string;
  readonly retentionDays: number;
  readonly archiveAfterDays: number | null;
  readonly deleteAfterDays: number | null;
  readonly enabled: boolean;
  readonly metadata: ObservabilityMetadata;

  constructor(input: {
    policyId: string;
    scope: string;
    retentionDays: number;
    archiveAfterDays?: number | null;
    deleteAfterDays?: number | null;
    enabled?: boolean;
    metadata?: ObservabilityMetadata;
  }) {
    this.policyId = input.policyId.trim();
    this.scope = input.scope.trim();
    this.retentionDays = input.retentionDays;
    this.archiveAfterDays = input.archiveAfterDays ?? null;
    this.deleteAfterDays = input.deleteAfterDays ?? null;
    this.enabled = input.enabled ?? true;
    this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
    if (!this.policyId || !this.scope) {
      throw new Error("RetentionPolicy requires policyId and scope");
    }
    if (!Number.isInteger(this.retentionDays) || this.retentionDays < 0) {
      throw new Error("RetentionPolicy.retentionDays must be a non-negative integer");
    }
    Object.freeze(this);
  }
}

