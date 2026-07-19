import type { DistributionState } from "../../domain";
import { NormalizedStatus } from "../normalization/normalizedStatus";
import { StatusEvidence } from "../types/statusTypes";

export class StatusSnapshot {
  readonly releaseId: string;
  readonly providerReference: string | null;
  readonly current: NormalizedStatus;
  readonly previous: NormalizedStatus | null;
  readonly capturedAt: string;
  readonly version: number;
  readonly evidence: readonly StatusEvidence[];
  readonly metadata: Readonly<Record<string, unknown>>;

  constructor(input: {
    releaseId: string;
    providerReference?: string | null;
    current: NormalizedStatus;
    previous?: NormalizedStatus | null;
    capturedAt?: string;
    version?: number;
    evidence?: readonly StatusEvidence[];
    metadata?: Readonly<Record<string, unknown>>;
  }) {
    this.releaseId = input.releaseId.trim();
    this.providerReference = input.providerReference ?? null;
    this.current = input.current;
    this.previous = input.previous ?? null;
    this.capturedAt = input.capturedAt ?? new Date().toISOString();
    this.version = input.version ?? 1;
    this.evidence = Object.freeze([...(input.evidence ?? [])]);
    this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
    if (!this.releaseId) {
      throw new Error("StatusSnapshot.releaseId must not be empty");
    }
    if (!Number.isInteger(this.version) || this.version < 1) {
      throw new Error("StatusSnapshot.version must be a positive integer");
    }
    Object.freeze(this);
  }

  get currentState(): DistributionState {
    return this.current.canonicalState;
  }
}

