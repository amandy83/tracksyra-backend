import { Queue } from "bullmq";
import type { QueueScheduler } from "../scheduler/queueScheduler";
import { QueueEnvelope, QueueExecutionContext } from "../types/queueIntegrationTypes";
import { resolveBullMQConnection, resolveBullMQDelay } from "./bullmqSupport";

export class BullMQScheduler implements QueueScheduler {
  constructor(private readonly queueName: string) {}

  schedule(envelope: QueueEnvelope): string | null {
    const queue = new Queue(this.queueName, {
      connection: resolveBullMQConnection(),
    });
    void queue
      .add(envelope.type, envelope, {
        jobId: envelope.messageId,
        delay: resolveBullMQDelay(envelope),
        removeOnComplete: false,
        removeOnFail: false,
      })
      .then((job) => queue.close().catch(() => undefined).then(() => String(job.id ?? envelope.messageId)));
    return envelope.messageId;
  }

  next(context: QueueExecutionContext): string | null {
    const scheduledAt = context.metadata?.scheduledAt;
    return typeof scheduledAt === "string" && scheduledAt ? scheduledAt : null;
  }
}
