import type { QueueEnvelope } from "../types/queueIntegrationTypes";

export interface QueueProducer {
  enqueue(envelope: QueueEnvelope): Promise<string> | string;
  enqueueMany(envelopes: readonly QueueEnvelope[]): Promise<readonly string[]> | readonly string[];
}
