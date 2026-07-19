import type { StatusConflictType, StatusResolutionStrategy } from "../types/statusTypes";

export class ConflictResolution {
  readonly releaseId: string;
  readonly conflictType: StatusConflictType;
  readonly strategy: StatusResolutionStrategy;
  readonly resolved: boolean;
  readonly resolvedAt: string | null;
  readonly reason: string | null;
  readonly metadata: Readonly<Record<string, unknown>>;

  constructor(input: {
    releaseId: string;
    conflictType: StatusConflictType;
    strategy: StatusResolutionStrategy;
    resolved: boolean;
    resolvedAt?: string | null;
    reason?: string | null;
    metadata?: Readonly<Record<string, unknown>>;
  }) {
    this.releaseId = input.releaseId.trim();
    this.conflictType = input.conflictType;
    this.strategy = input.strategy;
    this.resolved = input.resolved;
    this.resolvedAt = input.resolvedAt ?? null;
    this.reason = input.reason ?? null;
    this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
    if (!this.releaseId) {
      throw new Error("ConflictResolution.releaseId must not be empty");
    }
    Object.freeze(this);
  }
}

export interface ConflictResolver {
  resolve(input: {
    releaseId: string;
    conflictType: StatusConflictType;
    reason?: string | null;
    metadata?: Readonly<Record<string, unknown>>;
  }): ConflictResolution;
}

