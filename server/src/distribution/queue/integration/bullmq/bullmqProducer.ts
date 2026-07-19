import { Queue } from "bullmq";
import type { QueueProducer } from "../producer/queueProducer";
import { QueueEnvelope } from "../types/queueIntegrationTypes";
import { resolveBullMQAttempts, resolveBullMQBackoff, resolveBullMQConnection, resolveBullMQDelay, resolveBullMQJobId, resolveBullMQPriority } from "./bullmqSupport";
import type { QueueSerializer } from "../serializer/queueSerializer";

export class BullMQQueueProducer implements QueueProducer {
  constructor(
    private readonly queueName: string,
    private readonly serializer: QueueSerializer,
  ) {}

  async enqueue(envelope: QueueEnvelope): Promise<string> {
    const queue = new Queue(this.queueName, {
      connection: resolveBullMQConnection(),
    });
    try {
      const job = await queue.add(
        envelope.type,
        {
          envelope: this.serializer.serializeEnvelope(envelope),
          type: envelope.type,
          messageId: envelope.messageId,
        },
        {
          jobId: resolveBullMQJobId(envelope),
          priority: resolveBullMQPriority(envelope),
          delay: resolveBullMQDelay(envelope),
          attempts: resolveBullMQAttempts(envelope),
          backoff: resolveBullMQBackoff(envelope),
          removeOnComplete: { age: 86_400, count: 1_000 },
          removeOnFail: false,
        },
      );
      return String(job.id ?? envelope.messageId);
    } finally {
      await queue.close().catch(() => undefined);
    }
  }

  async enqueueMany(envelopes: readonly QueueEnvelope[]): Promise<readonly string[]> {
    const results = await Promise.all(envelopes.map((envelope) => this.enqueue(envelope)));
    return results;
  }
}
