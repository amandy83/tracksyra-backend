import type { QueueEnvelope } from "../types/queueIntegrationTypes";

export interface QueueConsumer {
  consume(handler: (envelope: QueueEnvelope) => Promise<void> | void): Promise<void>;
  stop(): Promise<void> | void;
}
