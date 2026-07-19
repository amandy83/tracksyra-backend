import { Queue } from "bullmq";
import { resolveBullMQConnection } from "./bullmqSupport.js";
export class BullMQDeadLetterHandler {
    queueName;
    producer;
    serializer;
    deserializer;
    constructor(queueName, producer, serializer, deserializer) {
        this.queueName = queueName;
        this.producer = producer;
        this.serializer = serializer;
        this.deserializer = deserializer;
    }
    async handle(message) {
        const queue = new Queue(`${this.queueName}.dlq`, {
            connection: resolveBullMQConnection(),
        });
        try {
            const envelope = this.extractEnvelope(message.body);
            const payload = {
                envelope,
                error: message.reason,
                reason: message.reason,
            };
            await queue.add("dead-letter", this.serializer.serialize({ ...message, body: payload }), {
                jobId: message.messageId,
                removeOnComplete: false,
                removeOnFail: false,
            });
        }
        finally {
            await queue.close().catch(() => undefined);
        }
    }
    async replay(messageId) {
        const queue = new Queue(`${this.queueName}.dlq`, {
            connection: resolveBullMQConnection(),
        });
        try {
            const job = await queue.getJob(messageId);
            if (!job)
                return false;
            const payload = typeof job.data === "string"
                ? this.deserializer.deserialize(job.data)
                : this.deserializer.deserialize(JSON.stringify(job.data ?? {}));
            const envelope = payload.body?.envelope;
            if (!envelope) {
                await job.remove();
                return false;
            }
            const queueEnvelope = this.deserializer.deserializeEnvelope(envelope);
            await this.producer.enqueue(queueEnvelope);
            await job.remove();
            return true;
        }
        finally {
            await queue.close().catch(() => undefined);
        }
    }
    extractEnvelope(body) {
        if (body && typeof body === "object" && "messageId" in body && "type" in body && "tracing" in body) {
            return this.serializer.serializeEnvelope(body);
        }
        if (typeof body === "string") {
            return body;
        }
        if (body && typeof body === "object" && "envelope" in body && typeof body.envelope === "string") {
            return String(body.envelope);
        }
        return null;
    }
}
