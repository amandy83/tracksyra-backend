import type { QueueEnvelope } from "../types/queueIntegrationTypes";

export interface QueueDeserializer {
  deserialize<T>(value: string): T;
  deserializeEnvelope(value: string): QueueEnvelope;
}
