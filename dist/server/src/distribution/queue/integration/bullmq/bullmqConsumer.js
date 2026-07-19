import { Worker } from "bullmq";
import { resolveBullMQConnection, createBullMQQueueConfiguration } from "./bullmqSupport.js";
export class BullMQConsumer {
    queueName;
    deserializer;
    deadLetterHandler;
    logger;
    worker = null;
    constructor(queueName, deserializer, deadLetterHandler, logger) {
        this.queueName = queueName;
        this.deserializer = deserializer;
        this.deadLetterHandler = deadLetterHandler;
        this.logger = logger;
    }
    async consume(handler) {
        if (this.worker)
            return;
        const configuration = createBullMQQueueConfiguration(this.queueName);
        this.worker = new Worker(this.queueName, async (job) => {
            const envelope = this.extractEnvelope(job.data);
            await handler(envelope);
        }, {
            connection: resolveBullMQConnection(),
            prefix: configuration.namespace ?? undefined,
            concurrency: configuration.concurrency,
        });
        this.worker.on("failed", async (job, error) => {
            this.logger.error("queue job failed", {
                queueName: this.queueName,
                jobId: job?.id ?? null,
                error: error instanceof Error ? error.message : String(error),
            });
            if (!job)
                return;
            const attempts = job.opts.attempts ?? 1;
            const attemptsMade = typeof job.attemptsMade === "number" ? job.attemptsMade : 0;
            if (attemptsMade < attempts)
                return;
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
    async stop() {
        if (!this.worker)
            return;
        await this.worker.close();
        this.worker = null;
    }
    extractEnvelope(data) {
        if (typeof data === "string") {
            return this.deserializer.deserializeEnvelope(data);
        }
        if (data && typeof data === "object" && "envelope" in data && typeof data.envelope === "string") {
            return this.deserializer.deserializeEnvelope(String(data.envelope));
        }
        return this.deserializer.deserializeEnvelope(JSON.stringify(data ?? {}));
    }
}
