import type { RoyaltyMetadata } from "../types/royaltyTypes";

export class RevenueCalculation {
  readonly calculationId: string;
  readonly ledgerId: string;
  readonly releaseId: string;
  readonly grossRevenue: number;
  readonly platformFees: number;
  readonly taxes: number;
  readonly adjustments: number;
  readonly netRevenue: number;
  readonly artistShare: number;
  readonly currency: string;
  readonly calculatedAt: string;
  readonly metadata: RoyaltyMetadata;

  constructor(input: {
    calculationId: string;
    ledgerId: string;
    releaseId: string;
    grossRevenue: number;
    platformFees: number;
    taxes: number;
    adjustments: number;
    netRevenue: number;
    artistShare: number;
    currency: string;
    calculatedAt?: string;
    metadata?: RoyaltyMetadata;
  }) {
    this.calculationId = input.calculationId.trim();
    this.ledgerId = input.ledgerId.trim();
    this.releaseId = input.releaseId.trim();
    this.grossRevenue = input.grossRevenue;
    this.platformFees = input.platformFees;
    this.taxes = input.taxes;
    this.adjustments = input.adjustments;
    this.netRevenue = input.netRevenue;
    this.artistShare = input.artistShare;
    this.currency = input.currency.trim().toUpperCase();
    this.calculatedAt = input.calculatedAt ?? new Date().toISOString();
    this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
    if (!this.calculationId || !this.ledgerId || !this.releaseId || !this.currency) {
      throw new Error("RevenueCalculation requires non-empty identifiers and currency");
    }
    Object.freeze(this);
  }
}

