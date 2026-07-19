import type { WorkerExecutionContext, WorkerExecutionResult, WorkerPipelineExecution } from "../types/workerIntegrationTypes";

export interface PipelineExecutor {
  execute(pipeline: WorkerPipelineExecution, context: WorkerExecutionContext): Promise<WorkerExecutionResult> | WorkerExecutionResult;
}

export interface WorkerPipelineRegistry {
  register(pipeline: WorkerPipelineExecution): void;
  resolve(pipelineExecutionId: string): WorkerPipelineExecution | null;
  list(): readonly WorkerPipelineExecution[];
}
