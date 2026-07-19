import { QueueDispatcher } from "../../queue/queueDispatcher.js";
export class InMemoryDistributionQueue {
    jobs = [];
    async enqueue(job) {
        this.jobs.push(job);
    }
    drain() {
        return this.jobs.splice(0, this.jobs.length);
    }
}
export class BullMqDistributionQueue {
    async enqueue(job) {
        await QueueDispatcher.enqueueDistribution({
            distributionJob: job,
            actorUserId: null,
            correlationId: job.id,
            traceId: job.id,
            idempotencyKey: `distribution:${job.id}`,
            sourceSystem: "distribution",
        });
    }
}
