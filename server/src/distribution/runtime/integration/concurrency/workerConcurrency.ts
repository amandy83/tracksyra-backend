import type { WorkerExecutionContext } from "../types/workerIntegrationTypes";

export interface ConcurrencyController {
  canRun(context: WorkerExecutionContext): boolean;
  acquire(context: WorkerExecutionContext): Promise<boolean> | boolean;
  release(context: WorkerExecutionContext): Promise<boolean> | boolean;
  resolveConflict(context: WorkerExecutionContext, conflicting: WorkerExecutionContext): string;
}
