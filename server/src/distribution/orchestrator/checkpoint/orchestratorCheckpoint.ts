import type { ExecutionStageName } from "../../execution/types";
import type { OrchestrationMetadata } from "../types/orchestratorTypes";

export class OrchestratorCheckpoint {
  readonly checkpointId: string;
  readonly orchestrationId: string;
  readonly releaseId: string;
  readonly stage: string;
  readonly executionStage: ExecutionStageName | null;
  readonly createdAt: string;
  readonly retryCount: number;
  readonly metadata: OrchestrationMetadata;

  constructor(input: {
    checkpointId: string;
    orchestrationId: string;
    releaseId: string;
    stage: string;
    executionStage?: ExecutionStageName | null;
    createdAt?: string;
    retryCount?: number;
    metadata?: OrchestrationMetadata;
  }) {
    this.checkpointId = input.checkpointId.trim();
    this.orchestrationId = input.orchestrationId.trim();
    this.releaseId = input.releaseId.trim();
    this.stage = input.stage.trim();
    this.executionStage = input.executionStage ?? null;
    this.createdAt = input.createdAt ?? new Date().toISOString();
    this.retryCount = input.retryCount ?? 0;
    this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
    if (!this.checkpointId || !this.orchestrationId || !this.releaseId || !this.stage) {
      throw new Error("OrchestratorCheckpoint requires identifiers");
    }
    Object.freeze(this);
  }
}

export interface OrchestratorCheckpointCoordinator {
  create(stage: string, orchestrationId: string, releaseId: string): OrchestratorCheckpoint;
  restore(checkpointId: string): OrchestratorCheckpoint | null;
  validate(checkpoint: OrchestratorCheckpoint): boolean;
  cleanup(orchestrationId: string): number;
}
