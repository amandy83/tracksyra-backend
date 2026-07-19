import type { ExecutionPipelineName, ExecutionStageName } from "../../execution/types";

export class WorkerPipeline {
  readonly pipelineId: string;
  readonly name: ExecutionPipelineName;
  readonly stages: readonly ExecutionStageName[];
  readonly createdAt: string;
  readonly metadata: Readonly<Record<string, unknown>>;

  constructor(input: {
    pipelineId: string;
    name: ExecutionPipelineName;
    stages: readonly ExecutionStageName[];
    createdAt?: string;
    metadata?: Readonly<Record<string, unknown>>;
  }) {
    this.pipelineId = input.pipelineId.trim();
    this.name = input.name;
    this.stages = Object.freeze([...(input.stages ?? [])]);
    this.createdAt = input.createdAt ?? new Date().toISOString();
    this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
    if (!this.pipelineId) {
      throw new Error("WorkerPipeline.pipelineId must not be empty");
    }
    Object.freeze(this);
  }
}

export interface WorkerPipelineExecutor {
  execute(pipeline: WorkerPipeline): Promise<void> | void;
}

