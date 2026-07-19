import type { DistributionState } from "../../domain";
import { StatusEvidence, StatusSyncSource } from "../types/statusTypes";

export class NormalizedStatus {
  readonly releaseId: string;
  readonly providerReference: string | null;
  readonly canonicalState: DistributionState;
  readonly rawStatus: string;
  readonly source: StatusSyncSource;
  readonly normalizedAt: string;
  readonly confidence: number;
  readonly evidence: StatusEvidence | null;
  readonly metadata: Readonly<Record<string, unknown>>;

  constructor(input: {
    releaseId: string;
    providerReference?: string | null;
    canonicalState: DistributionState;
    rawStatus: string;
    source: StatusSyncSource;
    normalizedAt?: string;
    confidence?: number;
    evidence?: StatusEvidence | null;
    metadata?: Readonly<Record<string, unknown>>;
  }) {
    this.releaseId = input.releaseId.trim();
    this.providerReference = input.providerReference ?? null;
    this.canonicalState = input.canonicalState;
    this.rawStatus = input.rawStatus.trim();
    this.source = input.source;
    this.normalizedAt = input.normalizedAt ?? new Date().toISOString();
    this.confidence = input.confidence ?? 1;
    this.evidence = input.evidence ?? null;
    this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
    if (!this.releaseId || !this.rawStatus) {
      throw new Error("NormalizedStatus requires releaseId and rawStatus");
    }
    if (!Number.isFinite(this.confidence) || this.confidence < 0 || this.confidence > 1) {
      throw new Error("NormalizedStatus.confidence must be between 0 and 1");
    }
    Object.freeze(this);
  }
}

export interface StatusNormalizer {
  normalize(event: import("../events/providerStatusEvent").ProviderStatusEvent): NormalizedStatus;
}

