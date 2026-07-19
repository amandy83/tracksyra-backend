import type { WorkerExecutionContext, WorkerExecutionRequest, WorkerExecutionResult } from "../types/workerIntegrationTypes";

export interface WorkerMiddleware {
  handle(
    request: WorkerExecutionRequest,
    context: WorkerExecutionContext,
    next: WorkerMiddlewareNext,
  ): Promise<WorkerExecutionResult> | WorkerExecutionResult;
}

export interface WorkerMiddlewareNext {
  handle(request: WorkerExecutionRequest, context: WorkerExecutionContext): Promise<WorkerExecutionResult> | WorkerExecutionResult;
}

export interface WorkerMiddlewareChain {
  use(middleware: WorkerMiddleware): void;
  list(): readonly WorkerMiddleware[];
}
