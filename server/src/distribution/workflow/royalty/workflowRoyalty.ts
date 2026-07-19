import type { WorkflowMetadata } from "../types/workflowTypes";

export class WorkflowRoyaltyFlow<TMetadata extends WorkflowMetadata = WorkflowMetadata> {
  readonly royaltyId: string;
  readonly steps: readonly string[];
  readonly createdAt: string;
  readonly metadata: TMetadata;

  constructor(input: {
    royaltyId: string;
    steps?: readonly string[];
    createdAt?: string;
    metadata?: TMetadata;
  }) {
    this.royaltyId = input.royaltyId.trim();
    this.steps = Object.freeze([...(input.steps ?? [])]);
    this.createdAt = input.createdAt ?? new Date().toISOString();
    this.metadata = Object.freeze({ ...(input.metadata ?? {}) }) as TMetadata;
    if (!this.royaltyId) {
      throw new Error("WorkflowRoyaltyFlow.royaltyId must not be empty");
    }
    Object.freeze(this);
  }
}
