import type { QueueEnvelope, QueueExecutionContext, QueueExecutionResult } from "../types/queueIntegrationTypes";

export interface QueueMiddleware {
  handle(
    envelope: QueueEnvelope,
    context: QueueExecutionContext,
    next: QueueMiddlewareNext,
  ): Promise<QueueExecutionResult> | QueueExecutionResult;
}

export interface QueueMiddlewareNext {
  handle(envelope: QueueEnvelope, context: QueueExecutionContext): Promise<QueueExecutionResult> | QueueExecutionResult;
}

export interface QueueMiddlewareChain {
  use(middleware: QueueMiddleware): void;
  list(): readonly QueueMiddleware[];
}
