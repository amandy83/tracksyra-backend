import type { QueueEnvelope } from "../types/queueIntegrationTypes";

export interface QueueSerializer {
  serialize<T>(value: T): string;
  serializeEnvelope(envelope: QueueEnvelope): string;
}
