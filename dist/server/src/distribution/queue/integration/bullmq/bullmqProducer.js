import { Queue } from "bullmq";
import { resolveBullMQAttempts, resolveBullMQBackoff, resolveBullMQConnection, resolveBullMQDelay, resolveBullMQJobId, resolveBullMQPriority } from "./bullmqSupport.js";
export class BullMQQueueProducer {
    queueName;
    serializer;
    constructor(queueName, serializer) {
        this.queueName = queueName;
        this.serializer = serializer;
    }
    async enqueue(envelope) {
        const queue = new Queue(this.queueName, {
            connection: resolveBullMQConnection(),
        });
        try {
            const job = await queue.add(envelope.type, {
                envelope: this.serializer.serializeEnvelope(envelope),
                type: envelope.type,
                messageId: envelope.messageId,
            }, {
                jobId: resolveBullMQJobId(envelope),
                priority: resolveBullMQPriority(envelope),
                delay: resolveBullMQDelay(envelope),
                attempts: resolveBullMQAttempts(envelope),
                backoff: resolveBullMQBackoff(envelope),
                removeOnComplete: { age: 86_400, count: 1_000 },
                removeOnFail: false,
            });
            return String(job.id ?? envelope.messageId);
        }
        finally {
            await queue.close().catch(() => undefined);
        }
    }
    async enqueueMany(envelopes) {
        const results = await Promise.all(envelopes.map((envelope) => this.enqueue(envelope)));
        return results;
    }
}
