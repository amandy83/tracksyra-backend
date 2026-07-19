import type { WorkflowMetadata } from "../types/workflowTypes";

export class WorkflowCompensationGraph<TMetadata extends WorkflowMetadata = WorkflowMetadata> {
  readonly graphId: string;
  readonly actions: readonly string[];
  readonly createdAt: string;
  readonly metadata: TMetadata;

  constructor(input: {
    graphId: string;
    actions?: readonly string[];
    createdAt?: string;
    metadata?: TMetadata;
  }) {
    this.graphId = input.graphId.trim();
    this.actions = Object.freeze([...(input.actions ?? [])]);
    this.createdAt = input.createdAt ?? new Date().toISOString();
    this.metadata = Object.freeze({ ...(input.metadata ?? {}) }) as TMetadata;
    if (!this.graphId) {
      throw new Error("WorkflowCompensationGraph.graphId must not be empty");
    }
    Object.freeze(this);
  }
}
