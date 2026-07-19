import { ConflictResolution } from "../conflict/conflictResolution";
import { NormalizedStatus } from "../normalization/normalizedStatus";
import { StatusSnapshot } from "../snapshot/statusSnapshot";
import { StatusTransition } from "../types/statusTypes";

export class ReconciliationResult {
  readonly releaseId: string;
  readonly success: boolean;
  readonly snapshot: StatusSnapshot;
  readonly normalizedStatus: NormalizedStatus;
  readonly transition: StatusTransition | null;
  readonly conflictResolution: ConflictResolution | null;
  readonly warnings: readonly string[];
  readonly errors: readonly string[];
  readonly reconciledAt: string;
  readonly metadata: Readonly<Record<string, unknown>>;

  constructor(input: {
    releaseId: string;
    success: boolean;
    snapshot: StatusSnapshot;
    normalizedStatus: NormalizedStatus;
    transition?: StatusTransition | null;
    conflictResolution?: ConflictResolution | null;
    warnings?: readonly string[];
    errors?: readonly string[];
    reconciledAt?: string;
    metadata?: Readonly<Record<string, unknown>>;
  }) {
    this.releaseId = input.releaseId.trim();
    this.success = input.success;
    this.snapshot = input.snapshot;
    this.normalizedStatus = input.normalizedStatus;
    this.transition = input.transition ?? null;
    this.conflictResolution = input.conflictResolution ?? null;
    this.warnings = Object.freeze([...(input.warnings ?? [])]);
    this.errors = Object.freeze([...(input.errors ?? [])]);
    this.reconciledAt = input.reconciledAt ?? new Date().toISOString();
    this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
    if (!this.releaseId) {
      throw new Error("ReconciliationResult.releaseId must not be empty");
    }
    Object.freeze(this);
  }
}

export interface ReconciliationEngine {
  reconcile(input: {
    snapshot: StatusSnapshot;
    normalizedStatus: NormalizedStatus;
    transition?: StatusTransition | null;
  }): Promise<ReconciliationResult> | ReconciliationResult;
}

