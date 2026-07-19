import type { WorkflowMetadata, WorkflowStageName } from "../types/workflowTypes";

export class WorkflowTimelineFlow<TMetadata extends WorkflowMetadata = WorkflowMetadata> {
  readonly timelineId: string;
  readonly entries: readonly WorkflowStageName[];
  readonly updatedAt: string;
  readonly metadata: TMetadata;

  constructor(input: {
    timelineId: string;
    entries?: readonly WorkflowStageName[];
    updatedAt?: string;
    metadata?: TMetadata;
  }) {
    this.timelineId = input.timelineId.trim();
    this.entries = Object.freeze([...(input.entries ?? [])]);
    this.updatedAt = input.updatedAt ?? new Date().toISOString();
    this.metadata = Object.freeze({ ...(input.metadata ?? {}) }) as TMetadata;
    if (!this.timelineId) {
      throw new Error("WorkflowTimelineFlow.timelineId must not be empty");
    }
    Object.freeze(this);
  }
}
