import type { RoyaltyMetadata } from "../types/royaltyTypes";

export class Hold {
  readonly holdId: string;
  readonly releaseId: string;
  readonly reason: string;
  readonly active: boolean;
  readonly appliedAt: string;
  readonly releasedAt: string | null;
  readonly metadata: RoyaltyMetadata;

  constructor(input: {
    holdId: string;
    releaseId: string;
    reason: string;
    active?: boolean;
    appliedAt?: string;
    releasedAt?: string | null;
    metadata?: RoyaltyMetadata;
  }) {
    this.holdId = input.holdId.trim();
    this.releaseId = input.releaseId.trim();
    this.reason = input.reason.trim();
    this.active = input.active ?? true;
    this.appliedAt = input.appliedAt ?? new Date().toISOString();
    this.releasedAt = input.releasedAt ?? null;
    this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
    if (!this.holdId || !this.releaseId || !this.reason) {
      throw new Error("Hold requires non-empty identifiers and reason");
    }
    Object.freeze(this);
  }
}

