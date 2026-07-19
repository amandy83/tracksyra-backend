import type { RoyaltyMetadata } from "../types/royaltyTypes";
import { RoyaltyEntry } from "../reports/royaltyReport";

export class RoyaltyLedger {
  readonly ledgerId: string;
  readonly releaseId: string;
  readonly connectorId: string | null;
  readonly currency: string;
  readonly entries: readonly RoyaltyEntry[];
  readonly grossRevenue: number;
  readonly netRevenue: number;
  readonly version: number;
  readonly createdAt: string;
  readonly metadata: RoyaltyMetadata;

  constructor(input: {
    ledgerId: string;
    releaseId: string;
    currency: string;
    entries: readonly RoyaltyEntry[];
    grossRevenue: number;
    netRevenue: number;
    version?: number;
    connectorId?: string | null;
    createdAt?: string;
    metadata?: RoyaltyMetadata;
  }) {
    this.ledgerId = input.ledgerId.trim();
    this.releaseId = input.releaseId.trim();
    this.connectorId = input.connectorId ?? null;
    this.currency = input.currency.trim().toUpperCase();
    this.entries = Object.freeze([...(input.entries ?? [])]);
    this.grossRevenue = input.grossRevenue;
    this.netRevenue = input.netRevenue;
    this.version = input.version ?? 1;
    this.createdAt = input.createdAt ?? new Date().toISOString();
    this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
    if (!this.ledgerId || !this.releaseId || !this.currency) {
      throw new Error("RoyaltyLedger requires non-empty identifiers and currency");
    }
    if (!Number.isInteger(this.version) || this.version < 1) {
      throw new Error("RoyaltyLedger.version must be a positive integer");
    }
    Object.freeze(this);
  }
}

