import type { WorkflowMetadata } from "../types/workflowTypes";

export class WorkflowRecoveryGraph<TMetadata extends WorkflowMetadata = WorkflowMetadata> {
  readonly graphId: string;
  readonly stages: readonly string[];
  readonly createdAt: string;
  readonly metadata: TMetadata;

  constructor(input: {
    graphId: string;
    stages?: readonly string[];
    createdAt?: string;
    metadata?: TMetadata;
  }) {
    this.graphId = input.graphId.trim();
    this.stages = Object.freeze([...(input.stages ?? [])]);
    this.createdAt = input.createdAt ?? new Date().toISOString();
    this.metadata = Object.freeze({ ...(input.metadata ?? {}) }) as TMetadata;
    if (!this.graphId) {
      throw new Error("WorkflowRecoveryGraph.graphId must not be empty");
    }
    Object.freeze(this);
  }
}
