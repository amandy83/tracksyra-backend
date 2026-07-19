import { QueueEnvelope } from "../types/queueIntegrationTypes";
import type { QueueSerializer } from "../serializer/queueSerializer";

export class BullMQQueueSerializer implements QueueSerializer {
  serialize<T>(value: T): string {
    return JSON.stringify(value);
  }

  serializeEnvelope(envelope: QueueEnvelope): string {
    return JSON.stringify(envelope);
  }
}
