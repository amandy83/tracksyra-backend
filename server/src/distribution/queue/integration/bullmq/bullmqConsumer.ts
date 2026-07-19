import { Worker, type Job } from "bullmq";
import type { QueueConsumer } from "../consumer/queueConsumer";
import { QueueEnvelope } from "../types/queueIntegrationTypes";
import { resolveBullMQConnection, createBullMQQueueConfiguration } from "./bullmqSupport";
import type { QueueDeserializer } from "../deserializer/queueDeserializer";
import type { DeadLetterHandler } from "../deadletter/deadLetter";
import type { QueueLogger } from "../logging/queueLogger";

export class BullMQConsumer implements QueueConsumer {
  private worker: Worker | null = null;

  constructor(
    private readonly queueName: string,
    private readonly deserializer: QueueDeserializer,
    private readonly deadLetterHandler: DeadLetterHandler,
    private readonly logger: QueueLogger,
  ) {}

  async consume(handler: (envelope: QueueEnvelope) => Promise<void> | void): Promise<void> {
    if (this.worker) return;

    const configuration = createBullMQQueueConfiguration(this.queueName);
    this.worker = new Worker(
      this.queueName,
      async (job: Job) => {
        const envelope = this.extractEnvelope(job.data);
        await handler(envelope);
      },
      {
      connection: resolveBullMQConnection(),
        prefix: configuration.namespace ?? undefined,
        concurrency: configuration.concurrency,
      },
    );

    this.worker.on("failed", async (job, error) => {
      this.logger.error("queue job failed", {
        queueName: this.queueName,
        jobId: job?.id ?? null,
        error: error instanceof Error ? error.message : String(error),
      });

      if (!job) return;
      const attempts = job.opts.attempts ?? 1;
      const attemptsMade = typeof job.attemptsMade === "number" ? job.attemptsMade : 0;
      if (attemptsMade < attempts) return;

      await this.deadLetterHandler.handle({
        messageId: String(job.id ?? `${this.queueName}:dead-letter`),
        queueName: this.queueName,
        reason: error instanceof Error ? error.message : String(error),
        body: job.data,
        retryContext: null,
        failedAt: new Date().toISOString(),
        metadata: {},
      });
    });
  }

  async stop(): Promise<void> {
    if (!this.worker) return;
    await this.worker.close();
    this.worker = null;
  }

  private extractEnvelope(data: unknown): QueueEnvelope {
    if (typeof data === "string") {
      return this.deserializer.deserializeEnvelope(data);
    }
    if (data && typeof data === "object" && "envelope" in data && typeof (data as { envelope?: unknown }).envelope === "string") {
      return this.deserializer.deserializeEnvelope(String((data as { envelope: string }).envelope));
    }
    return this.deserializer.deserializeEnvelope(JSON.stringify(data ?? {}));
  }
}
