import type { WorkflowMetadata, WorkflowStageName } from "../types/workflowTypes";

export class WorkflowCheckpointStore<TMetadata extends WorkflowMetadata = WorkflowMetadata> {
  readonly storeId: string;
  readonly workflowId: string;
  readonly releaseId: string;
  readonly stage: WorkflowStageName;
  readonly createdAt: string;
  readonly metadata: TMetadata;

  constructor(input: {
    storeId: string;
    workflowId: string;
    releaseId: string;
    stage: WorkflowStageName;
    createdAt?: string;
    metadata?: TMetadata;
  }) {
    this.storeId = input.storeId.trim();
    this.workflowId = input.workflowId.trim();
    this.releaseId = input.releaseId.trim();
    this.stage = input.stage;
    this.createdAt = input.createdAt ?? new Date().toISOString();
    this.metadata = Object.freeze({ ...(input.metadata ?? {}) }) as TMetadata;
    if (!this.storeId || !this.workflowId || !this.releaseId) {
      throw new Error("WorkflowCheckpointStore requires non-empty identifiers");
    }
    Object.freeze(this);
  }
}
