import type { DistributionState } from "../../domain";
import { NormalizedStatus } from "../normalization/normalizedStatus";

export class TransitionValidationResult {
  readonly releaseId: string;
  readonly valid: boolean;
  readonly previousState: DistributionState | null;
  readonly nextState: DistributionState;
  readonly reason: string | null;
  readonly validatedAt: string;
  readonly metadata: Readonly<Record<string, unknown>>;

  constructor(input: {
    releaseId: string;
    valid: boolean;
    previousState?: DistributionState | null;
    nextState: DistributionState;
    reason?: string | null;
    validatedAt?: string;
    metadata?: Readonly<Record<string, unknown>>;
  }) {
    this.releaseId = input.releaseId.trim();
    this.valid = input.valid;
    this.previousState = input.previousState ?? null;
    this.nextState = input.nextState;
    this.reason = input.reason ?? null;
    this.validatedAt = input.validatedAt ?? new Date().toISOString();
    this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
    if (!this.releaseId) {
      throw new Error("TransitionValidationResult.releaseId must not be empty");
    }
    Object.freeze(this);
  }
}

export interface TransitionValidator {
  validate(
    currentState: DistributionState | null,
    next: NormalizedStatus,
  ): TransitionValidationResult;
}
