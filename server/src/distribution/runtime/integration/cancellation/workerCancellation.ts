import type { WorkerExecutionContext } from "../types/workerIntegrationTypes";

export interface CancellationService {
  request(context: WorkerExecutionContext, reason: string | null): Promise<WorkerExecutionContext> | WorkerExecutionContext;
  cancel(context: WorkerExecutionContext, reason: string | null): Promise<WorkerExecutionContext> | WorkerExecutionContext;
  isCancelled(context: WorkerExecutionContext): boolean;
}
