import type { RoyaltyMetadata } from "../types/royaltyTypes";
import { SettlementBatch } from "../settlement/settlementBatch";

export class Statement {
  readonly statementId: string;
  readonly releaseId: string;
  readonly settlementBatchId: string;
  readonly periodStart: string;
  readonly periodEnd: string;
  readonly currency: string;
  readonly amount: number;
  readonly generatedAt: string;
  readonly metadata: RoyaltyMetadata;

  constructor(input: {
    statementId: string;
    releaseId: string;
    settlementBatch: SettlementBatch;
    periodStart: string;
    periodEnd: string;
    currency: string;
    amount: number;
    generatedAt?: string;
    metadata?: RoyaltyMetadata;
  }) {
    this.statementId = input.statementId.trim();
    this.releaseId = input.releaseId.trim();
    this.settlementBatchId = input.settlementBatch.settlementId;
    this.periodStart = input.periodStart.trim();
    this.periodEnd = input.periodEnd.trim();
    this.currency = input.currency.trim().toUpperCase();
    this.amount = input.amount;
    this.generatedAt = input.generatedAt ?? new Date().toISOString();
    this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
    if (!this.statementId || !this.releaseId || !this.settlementBatchId || !this.currency) {
      throw new Error("Statement requires non-empty identifiers and currency");
    }
    Object.freeze(this);
  }
}

