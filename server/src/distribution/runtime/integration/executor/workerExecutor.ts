import type { WorkerExecutionContext, WorkerExecutionResult } from "../types/workerIntegrationTypes";

export interface WorkerExecutor {
  execute(context: WorkerExecutionContext): Promise<WorkerExecutionResult> | WorkerExecutionResult;
}
