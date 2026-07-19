import type { WorkflowStageName, WorkflowMetadata } from "../types/workflowTypes";

export class WorkflowRoute<TMetadata extends WorkflowMetadata = WorkflowMetadata> {
  readonly routeId: string;
  readonly from: WorkflowStageName;
  readonly to: WorkflowStageName;
  readonly createdAt: string;
  readonly metadata: TMetadata;

  constructor(input: {
    routeId: string;
    from: WorkflowStageName;
    to: WorkflowStageName;
    createdAt?: string;
    metadata?: TMetadata;
  }) {
    this.routeId = input.routeId.trim();
    this.from = input.from;
    this.to = input.to;
    this.createdAt = input.createdAt ?? new Date().toISOString();
    this.metadata = Object.freeze({ ...(input.metadata ?? {}) }) as TMetadata;
    if (!this.routeId) {
      throw new Error("WorkflowRoute.routeId must not be empty");
    }
    Object.freeze(this);
  }
}
