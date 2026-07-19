import type { WorkerExecutionRequest, WorkerExecutionResult } from "../types/workerIntegrationTypes";

export interface WorkerRunner {
  run(request: WorkerExecutionRequest): Promise<WorkerExecutionResult> | WorkerExecutionResult;
}
