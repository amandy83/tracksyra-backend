import type { OrchestrationStageName, OrchestrationMetadata } from "../types/orchestratorTypes";

export class OrchestratorPipeline {
  readonly pipelineId: string;
  readonly name: string;
  readonly stages: readonly OrchestrationStageName[];
  readonly createdAt: string;
  readonly metadata: OrchestrationMetadata;

  constructor(input: {
    pipelineId: string;
    name: string;
    stages: readonly OrchestrationStageName[];
    createdAt?: string;
    metadata?: OrchestrationMetadata;
  }) {
    this.pipelineId = input.pipelineId.trim();
    this.name = input.name.trim();
    this.stages = Object.freeze([...(input.stages ?? [])]);
    this.createdAt = input.createdAt ?? new Date().toISOString();
    this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
    if (!this.pipelineId || !this.name) {
      throw new Error("OrchestratorPipeline requires pipelineId and name");
    }
    Object.freeze(this);
  }
}

export interface OrchestratorPipelineCoordinator {
  coordinate(pipeline: OrchestratorPipeline): Promise<void> | void;
}
