import type { RoyaltyMetadata } from "../types/royaltyTypes";

export class RoyaltyReconciliation {
  readonly reconciliationId: string;
  readonly ledgerId: string;
  readonly releaseId: string;
  readonly balanced: boolean;
  readonly discrepancies: readonly string[];
  readonly reconciledAt: string;
  readonly metadata: RoyaltyMetadata;

  constructor(input: {
    reconciliationId: string;
    ledgerId: string;
    releaseId: string;
    balanced: boolean;
    discrepancies?: readonly string[];
    reconciledAt?: string;
    metadata?: RoyaltyMetadata;
  }) {
    this.reconciliationId = input.reconciliationId.trim();
    this.ledgerId = input.ledgerId.trim();
    this.releaseId = input.releaseId.trim();
    this.balanced = input.balanced;
    this.discrepancies = Object.freeze([...(input.discrepancies ?? [])]);
    this.reconciledAt = input.reconciledAt ?? new Date().toISOString();
    this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
    if (!this.reconciliationId || !this.ledgerId || !this.releaseId) {
      throw new Error("RoyaltyReconciliation requires non-empty identifiers");
    }
    Object.freeze(this);
  }
}
