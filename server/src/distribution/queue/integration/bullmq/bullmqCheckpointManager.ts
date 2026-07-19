import { Queue } from "bullmq";
import type { CheckpointManager } from "../checkpoint/queueCheckpoint";
import { QueueCheckpoint } from "../types/queueIntegrationTypes";
import { resolveBullMQConnection } from "./bullmqSupport";

export class BullMQCheckpointManager implements CheckpointManager {
  constructor(private readonly queueName: string) {}

  async create(executionId: string, queueName: string, stage: string): Promise<QueueCheckpoint> {
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
    } finally {
      await queue.close().catch(() => undefined);
    }
  }

  async restore(checkpointId: string): Promise<QueueCheckpoint | null> {
    const queue = new Queue(`${this.queueName}:checkpoints`, {
      connection: resolveBullMQConnection(),
    });
    try {
      const job = await queue.getJob(checkpointId);
      if (!job) return null;
      const data = job.data as QueueCheckpoint;
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
    } finally {
      await queue.close().catch(() => undefined);
    }
  }

  validate(checkpoint: QueueCheckpoint): boolean {
    return Boolean(checkpoint.checkpointId && checkpoint.executionId && checkpoint.queueName && checkpoint.stage);
  }

  async cleanup(executionId: string): Promise<number> {
    const queue = new Queue(`${this.queueName}:checkpoints`, {
      connection: resolveBullMQConnection(),
    });
    let removed = 0;
    try {
      const jobs = await queue.getJobs(["waiting", "delayed", "active", "completed", "failed"], 0, 1_000);
      for (const job of jobs) {
        const data = job.data as { executionId?: string } | undefined;
        if (data?.executionId === executionId) {
          await job.remove();
          removed += 1;
        }
      }
      return removed;
    } finally {
      await queue.close().catch(() => undefined);
    }
  }
}
