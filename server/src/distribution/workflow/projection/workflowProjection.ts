import type { WorkflowMetadata } from "../types/workflowTypes";

export class WorkflowProjectionFlow<TMetadata extends WorkflowMetadata = WorkflowMetadata> {
  readonly projectionId: string;
  readonly views: readonly string[];
  readonly createdAt: string;
  readonly metadata: TMetadata;

  constructor(input: {
    projectionId: string;
    views?: readonly string[];
    createdAt?: string;
    metadata?: TMetadata;
  }) {
    this.projectionId = input.projectionId.trim();
    this.views = Object.freeze([...(input.views ?? [])]);
    this.createdAt = input.createdAt ?? new Date().toISOString();
    this.metadata = Object.freeze({ ...(input.metadata ?? {}) }) as TMetadata;
    if (!this.projectionId) {
      throw new Error("WorkflowProjectionFlow.projectionId must not be empty");
    }
    Object.freeze(this);
  }
}
