import type { OrchestrationStageName, OrchestrationMetadata } from "../types/orchestratorTypes";

export class OrchestratorStage {
  readonly stageId: string;
  readonly name: OrchestrationStageName;
  readonly dependencies: readonly OrchestrationStageName[];
  readonly retryable: boolean;
  readonly checkpointable: boolean;
  readonly createdAt: string;
  readonly metadata: OrchestrationMetadata;

  constructor(input: {
    stageId: string;
    name: OrchestrationStageName;
    dependencies?: readonly OrchestrationStageName[];
    retryable?: boolean;
    checkpointable?: boolean;
    createdAt?: string;
    metadata?: OrchestrationMetadata;
  }) {
    this.stageId = input.stageId.trim();
    this.name = input.name;
    this.dependencies = Object.freeze([...(input.dependencies ?? [])]);
    this.retryable = input.retryable ?? true;
    this.checkpointable = input.checkpointable ?? true;
    this.createdAt = input.createdAt ?? new Date().toISOString();
    this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
    if (!this.stageId) {
      throw new Error("OrchestratorStage.stageId must not be empty");
    }
    Object.freeze(this);
  }
}

export interface StageCoordinator {
  coordinate(stage: OrchestratorStage): Promise<void> | void;
}

