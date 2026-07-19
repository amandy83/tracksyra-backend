import type { RoyaltyMetadata } from "../types/royaltyTypes";

export class RoyaltyEvent {
  readonly type:
    | "RoyaltyImported"
    | "LedgerCreated"
    | "RevenueCalculated"
    | "SettlementCreated"
    | "PaymentRequested"
    | "StatementGenerated"
    | "AdjustmentApplied"
    | "HoldApplied";
  readonly releaseId: string;
  readonly occurredAt: string;
  readonly payload: RoyaltyMetadata;

  constructor(input: {
    type: RoyaltyEvent["type"];
    releaseId: string;
    occurredAt?: string;
    payload?: RoyaltyMetadata;
  }) {
    this.type = input.type;
    this.releaseId = input.releaseId.trim();
    this.occurredAt = input.occurredAt ?? new Date().toISOString();
    this.payload = Object.freeze({ ...(input.payload ?? {}) });
    if (!this.releaseId) {
      throw new Error("RoyaltyEvent.releaseId must not be empty");
    }
    Object.freeze(this);
  }
}

export interface RoyaltyEventPublisher {
  publish(event: RoyaltyEvent): Promise<void> | void;
}

