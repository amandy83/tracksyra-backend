import type { WorkflowEventType, WorkflowMetadata, WorkflowStageName } from "../types/workflowTypes";

export class WorkflowEvent<TMetadata extends WorkflowMetadata = WorkflowMetadata> {
  readonly type: WorkflowEventType;
  readonly workflowId: string;
  readonly releaseId: string;
  readonly stage: WorkflowStageName | null;
  readonly occurredAt: string;
  readonly payload: TMetadata;

  constructor(input: {
    type: WorkflowEventType;
    workflowId: string;
    releaseId: string;
    stage?: WorkflowStageName | null;
    occurredAt?: string;
    payload?: TMetadata;
  }) {
    this.type = input.type;
    this.workflowId = input.workflowId.trim();
    this.releaseId = input.releaseId.trim();
    this.stage = input.stage ?? null;
    this.occurredAt = input.occurredAt ?? new Date().toISOString();
    this.payload = Object.freeze({ ...(input.payload ?? {}) }) as TMetadata;
    if (!this.workflowId || !this.releaseId) {
      throw new Error("WorkflowEvent requires non-empty identifiers");
    }
    Object.freeze(this);
  }
}
