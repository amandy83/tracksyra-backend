import type { RoyaltyMetadata } from "../types/royaltyTypes";
import { RevenueCalculation } from "../calculation/revenueCalculation";

export class SettlementBatch {
  readonly settlementId: string;
  readonly releaseId: string;
  readonly ledgerId: string;
  readonly calculation: RevenueCalculation;
  readonly currency: string;
  readonly netRevenue: number;
  readonly artistShare: number;
  readonly paymentRequested: boolean;
  readonly createdAt: string;
  readonly metadata: RoyaltyMetadata;

  constructor(input: {
    settlementId: string;
    releaseId: string;
    ledgerId: string;
    calculation: RevenueCalculation;
    currency: string;
    netRevenue: number;
    artistShare: number;
    paymentRequested?: boolean;
    createdAt?: string;
    metadata?: RoyaltyMetadata;
  }) {
    this.settlementId = input.settlementId.trim();
    this.releaseId = input.releaseId.trim();
    this.ledgerId = input.ledgerId.trim();
    this.calculation = input.calculation;
    this.currency = input.currency.trim().toUpperCase();
    this.netRevenue = input.netRevenue;
    this.artistShare = input.artistShare;
    this.paymentRequested = input.paymentRequested ?? false;
    this.createdAt = input.createdAt ?? new Date().toISOString();
    this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
    if (!this.settlementId || !this.releaseId || !this.ledgerId || !this.currency) {
      throw new Error("SettlementBatch requires non-empty identifiers and currency");
    }
    Object.freeze(this);
  }
}

