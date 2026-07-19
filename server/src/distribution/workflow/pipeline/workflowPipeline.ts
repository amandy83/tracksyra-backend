import type { WorkflowMetadata, WorkflowStageName } from "../types/workflowTypes";

export class WorkflowPipelineGraph<TMetadata extends WorkflowMetadata = WorkflowMetadata> {
  readonly pipelineId: string;
  readonly stageOrder: readonly WorkflowStageName[];
  readonly transitionOrder: readonly string[];
  readonly createdAt: string;
  readonly metadata: TMetadata;

  constructor(input: {
    pipelineId: string;
    stageOrder: readonly WorkflowStageName[];
    transitionOrder?: readonly string[];
    createdAt?: string;
    metadata?: TMetadata;
  }) {
    this.pipelineId = input.pipelineId.trim();
    this.stageOrder = Object.freeze([...(input.stageOrder ?? [])]);
    this.transitionOrder = Object.freeze([...(input.transitionOrder ?? [])]);
    this.createdAt = input.createdAt ?? new Date().toISOString();
    this.metadata = Object.freeze({ ...(input.metadata ?? {}) }) as TMetadata;
    if (!this.pipelineId) {
      throw new Error("WorkflowPipelineGraph.pipelineId must not be empty");
    }
    Object.freeze(this);
  }
}
