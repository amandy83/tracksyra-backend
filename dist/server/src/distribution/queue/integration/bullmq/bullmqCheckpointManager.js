import { Queue } from "bullmq";
import { QueueCheckpoint } from "../types/queueIntegrationTypes.js";
import { resolveBullMQConnection } from "./bullmqSupport.js";
export class BullMQCheckpointManager {
    queueName;
    constructor(queueName) {
        this.queueName = queueName;
    }
    async create(executionId, queueName, stage) {
        const queue = new Queue(`${this.queueName}:checkpoints`, {
            connection: resolveBullMQConnection(),
        });
        try {
            const checkpoint = new QueueCheckpoint({
                checkpointId: `${executionId}:${stage}`,
                executionId,
                queueName,
                stage,
                completedStages: [stage],
                metadata: { queueName, stage },
            });
            await queue.add("checkpoint", checkpoint, {
                jobId: checkpoint.checkpointId,
                removeOnComplete: false,
                removeOnFail: false,
            });
            return checkpoint;
        }
        finally {
            await queue.close().catch(() => undefined);
        }
    }
    async restore(checkpointId) {
        const queue = new Queue(`${this.queueName}:checkpoints`, {
            connection: resolveBullMQConnection(),
        });
        try {
            const job = await queue.getJob(checkpointId);
            if (!job)
                return null;
            const data = job.data;
            return new QueueCheckpoint({
                checkpointId: data.checkpointId,
                executionId: data.executionId,
                queueName: data.queueName,
                stage: data.stage,
                createdAt: data.createdAt,
                completedStages: data.completedStages,
                retryCount: data.retryCount,
                metadata: data.metadata,
            });
        }
        finally {
            await queue.close().catch(() => undefined);
        }
    }
    validate(checkpoint) {
        return Boolean(checkpoint.checkpointId && checkpoint.executionId && checkpoint.queueName && checkpoint.stage);
    }
    async cleanup(executionId) {
        const queue = new Queue(`${this.queueName}:checkpoints`, {
            connection: resolveBullMQConnection(),
        });
        let removed = 0;
        try {
            const jobs = await queue.getJobs(["waiting", "delayed", "active", "completed", "failed"], 0, 1_000);
            for (const job of jobs) {
                const data = job.data;
                if (data?.executionId === executionId) {
                    await job.remove();
                    removed += 1;
                }
            }
            return removed;
        }
        finally {
            await queue.close().catch(() => undefined);
        }
    }
}
