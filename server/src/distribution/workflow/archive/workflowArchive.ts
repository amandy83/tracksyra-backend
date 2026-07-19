import type { WorkflowMetadata } from "../types/workflowTypes";

export class WorkflowArchiveFlow<TMetadata extends WorkflowMetadata = WorkflowMetadata> {
  readonly archiveId: string;
  readonly createdAt: string;
  readonly location: string | null;
  readonly metadata: TMetadata;

  constructor(input: {
    archiveId: string;
    createdAt?: string;
    location?: string | null;
    metadata?: TMetadata;
  }) {
    this.archiveId = input.archiveId.trim();
    this.createdAt = input.createdAt ?? new Date().toISOString();
    this.location = input.location?.trim() || null;
    this.metadata = Object.freeze({ ...(input.metadata ?? {}) }) as TMetadata;
    if (!this.archiveId) {
      throw new Error("WorkflowArchiveFlow.archiveId must not be empty");
    }
    Object.freeze(this);
  }
}
