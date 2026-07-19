import type { QueueEnvelope, QueueExecutionContext } from "../types/queueIntegrationTypes";

export interface QueueScheduler {
  schedule(envelope: QueueEnvelope): string | null;
  next(context: QueueExecutionContext): string | null;
}
