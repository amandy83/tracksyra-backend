import { Queue } from "bullmq";
import type { DeadLetterHandler } from "../deadletter/deadLetter";
import { DeadLetterMessage, QueueEnvelope } from "../types/queueIntegrationTypes";
import type { QueueSerializer } from "../serializer/queueSerializer";
import type { QueueDeserializer } from "../deserializer/queueDeserializer";
import type { QueueProducer } from "../producer/queueProducer";
import { resolveBullMQConnection } from "./bullmqSupport";

type DeadLetterPayload = Readonly<{
  envelope: string | null;
  error: string;
  reason: string;
}>;

export class BullMQDeadLetterHandler implements DeadLetterHandler {
  constructor(
    private readonly queueName: string,
    private readonly producer: QueueProducer,
    private readonly serializer: QueueSerializer,
    private readonly deserializer: QueueDeserializer,
  ) {}

  async handle(message: DeadLetterMessage): Promise<void> {
    const queue = new Queue(`${this.queueName}.dlq`, {
      connection: resolveBullMQConnection(),
    });
    try {
      const envelope = this.extractEnvelope(message.body);
      const payload: DeadLetterPayload = {
        envelope,
        error: message.reason,
        reason: message.reason,
      };
      await queue.add("dead-letter", this.serializer.serialize({ ...message, body: payload }), {
        jobId: message.messageId,
        removeOnComplete: false,
        removeOnFail: false,
      });
    } finally {
      await queue.close().catch(() => undefined);
    }
  }

  async replay(messageId: string): Promise<boolean> {
    const queue = new Queue(`${this.queueName}.dlq`, {
      connection: resolveBullMQConnection(),
    });
    try {
      const job = await queue.getJob(messageId);
      if (!job) return false;
      const payload = typeof job.data === "string"
        ? this.deserializer.deserialize<{ body?: DeadLetterPayload; messageId?: string; queueName?: string }>(job.data)
        : this.deserializer.deserialize<{ body?: DeadLetterPayload; messageId?: string; queueName?: string }>(
            JSON.stringify(job.data ?? {}),
          );
      const envelope = payload.body?.envelope;
      if (!envelope) {
        await job.remove();
        return false;
      }
      const queueEnvelope = this.deserializer.deserializeEnvelope(envelope);
      await this.producer.enqueue(queueEnvelope);
      await job.remove();
      return true;
    } finally {
      await queue.close().catch(() => undefined);
    }
  }

  private extractEnvelope(body: unknown): string | null {
    if (body && typeof body === "object" && "messageId" in body && "type" in body && "tracing" in body) {
      return this.serializer.serializeEnvelope(body as QueueEnvelope);
    }
    if (typeof body === "string") {
      return body;
    }
    if (body && typeof body === "object" && "envelope" in body && typeof (body as { envelope?: unknown }).envelope === "string") {
      return String((body as { envelope: string }).envelope);
    }
    return null;
  }
}
