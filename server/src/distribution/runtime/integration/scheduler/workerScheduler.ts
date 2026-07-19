import type { WorkerExecutionContext, WorkerPipelineExecution } from "../types/workerIntegrationTypes";

export interface WorkerScheduler {
  schedule(context: WorkerExecutionContext, pipeline: WorkerPipelineExecution): string | null;
  next(context: WorkerExecutionContext, pipeline: WorkerPipelineExecution): string | null;
}
