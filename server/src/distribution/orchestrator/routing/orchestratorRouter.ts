import type { OrchestratorPipeline } from "../pipeline/orchestratorPipeline";
import type { OrchestratorStage } from "../stage/orchestratorStage";

export interface OrchestratorRouter {
  resolvePipeline(releaseId: string): OrchestratorPipeline;
  resolveStage(stageName: string): OrchestratorStage | null;
}

export interface ExecutionRouter {
  resolveExecution(releaseId: string): string | null;
}

