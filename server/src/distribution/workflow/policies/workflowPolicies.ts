import type { WorkflowMetadata } from "../types/workflowTypes";

export class WorkflowPolicySet<TMetadata extends WorkflowMetadata = WorkflowMetadata> {
  readonly policySetId: string;
  readonly retryableStages: readonly string[];
  readonly checkpointableStages: readonly string[];
  readonly compensableStages: readonly string[];
  readonly createdAt: string;
  readonly metadata: TMetadata;

  constructor(input: {
    policySetId: string;
    retryableStages?: readonly string[];
    checkpointableStages?: readonly string[];
    compensableStages?: readonly string[];
    createdAt?: string;
    metadata?: TMetadata;
  }) {
    this.policySetId = input.policySetId.trim();
    this.retryableStages = Object.freeze([...(input.retryableStages ?? [])]);
    this.checkpointableStages = Object.freeze([...(input.checkpointableStages ?? [])]);
    this.compensableStages = Object.freeze([...(input.compensableStages ?? [])]);
    this.createdAt = input.createdAt ?? new Date().toISOString();
    this.metadata = Object.freeze({ ...(input.metadata ?? {}) }) as TMetadata;
    if (!this.policySetId) {
      throw new Error("WorkflowPolicySet.policySetId must not be empty");
    }
    Object.freeze(this);
  }
}
