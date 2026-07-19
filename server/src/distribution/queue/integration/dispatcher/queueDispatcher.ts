import type { QueueEnvelope, QueueExecutionContext, QueueExecutionResult } from "../types/queueIntegrationTypes";

export interface QueueDispatcher {
  dispatch(envelope: QueueEnvelope, context: QueueExecutionContext): Promise<QueueExecutionResult> | QueueExecutionResult;
}
