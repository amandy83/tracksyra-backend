import type { RoyaltyMetadata } from "../types/royaltyTypes";

export class Adjustment {
  readonly adjustmentId: string;
  readonly releaseId: string;
  readonly ledgerId: string | null;
  readonly amount: number;
  readonly currency: string;
  readonly reason: string;
  readonly appliedAt: string;
  readonly metadata: RoyaltyMetadata;

  constructor(input: {
    adjustmentId: string;
    releaseId: string;
    amount: number;
    currency: string;
    reason: string;
    ledgerId?: string | null;
    appliedAt?: string;
    metadata?: RoyaltyMetadata;
  }) {
    this.adjustmentId = input.adjustmentId.trim();
    this.releaseId = input.releaseId.trim();
    this.ledgerId = input.ledgerId ?? null;
    this.amount = input.amount;
    this.currency = input.currency.trim().toUpperCase();
    this.reason = input.reason.trim();
    this.appliedAt = input.appliedAt ?? new Date().toISOString();
    this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
    if (!this.adjustmentId || !this.releaseId || !this.reason || !this.currency) {
      throw new Error("Adjustment requires non-empty identifiers, reason, and currency");
    }
    Object.freeze(this);
  }
}

