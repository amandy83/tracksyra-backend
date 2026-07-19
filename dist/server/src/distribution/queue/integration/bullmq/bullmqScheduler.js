import { Queue } from "bullmq";
import { resolveBullMQConnection, resolveBullMQDelay } from "./bullmqSupport.js";
export class BullMQScheduler {
    queueName;
    constructor(queueName) {
        this.queueName = queueName;
    }
    schedule(envelope) {
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
    next(context) {
        const scheduledAt = context.metadata?.scheduledAt;
        return typeof scheduledAt === "string" && scheduledAt ? scheduledAt : null;
    }
}
