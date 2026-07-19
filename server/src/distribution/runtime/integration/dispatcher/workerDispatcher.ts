import type { WorkerExecutionRequest, WorkerExecutionResult } from "../types/workerIntegrationTypes";

export interface WorkerDispatcher {
  dispatch(request: WorkerExecutionRequest): Promise<WorkerExecutionResult> | WorkerExecutionResult;
}
