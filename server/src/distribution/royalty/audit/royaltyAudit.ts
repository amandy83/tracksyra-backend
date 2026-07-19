import type { RoyaltyMetadata } from "../types/royaltyTypes";

export class RoyaltyAudit {
  readonly auditId: string;
  readonly releaseId: string;
  readonly eventType: string;
  readonly recordedAt: string;
  readonly metadata: RoyaltyMetadata;

  constructor(input: {
    auditId: string;
    releaseId: string;
    eventType: string;
    recordedAt?: string;
    metadata?: RoyaltyMetadata;
  }) {
    this.auditId = input.auditId.trim();
    this.releaseId = input.releaseId.trim();
    this.eventType = input.eventType.trim();
    this.recordedAt = input.recordedAt ?? new Date().toISOString();
    this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
    if (!this.auditId || !this.releaseId || !this.eventType) {
      throw new Error("RoyaltyAudit requires non-empty identifiers and eventType");
    }
    Object.freeze(this);
  }
}

