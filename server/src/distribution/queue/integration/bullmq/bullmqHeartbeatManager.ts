import { Queue } from "bullmq";
import type { HeartbeatManager } from "../heartbeat/queueHeartbeat";
import { QueueHeartbeat, QueueLease } from "../types/queueIntegrationTypes";
import { resolveBullMQConnection } from "./bullmqSupport";

export class BullMQHeartbeatManager implements HeartbeatManager {
  constructor(
    private readonly queueName: string,
    private readonly intervalMs: number,
  ) {}

  async start(lease: QueueLease): Promise<QueueHeartbeat> {
    const queue = new Queue(`${this.queueName}:heartbeats`, {
      connection: resolveBullMQConnection(),
    });
    try {
      const expiresAt = new Date(Date.now() + this.intervalMs).toISOString();
      await queue.add("heartbeat", { leaseId: lease.leaseId, owner: lease.owner, expiresAt }, {
        jobId: lease.leaseId,
        delay: this.intervalMs,
        removeOnComplete: false,
        removeOnFail: false,
      });
      return new QueueHeartbeat({
        heartbeatId: `${lease.leaseId}:heartbeat`,
        leaseId: lease.leaseId,
        queueName: this.queueName,
        owner: lease.owner,
        expiresAt,
        metadata: { queueName: this.queueName },
      });
    } finally {
      await queue.close().catch(() => undefined);
    }
  }

  async renew(heartbeat: QueueHeartbeat): Promise<QueueHeartbeat> {
    const queue = new Queue(`${this.queueName}:heartbeats`, {
      connection: resolveBullMQConnection(),
    });
    try {
      const job = await queue.getJob(heartbeat.leaseId);
      if (job) {
        await job.remove();
      }
      const expiresAt = new Date(Date.now() + this.intervalMs).toISOString();
      await queue.add("heartbeat", { leaseId: heartbeat.leaseId, owner: heartbeat.owner, expiresAt }, {
        jobId: heartbeat.leaseId,
        delay: this.intervalMs,
        removeOnComplete: false,
        removeOnFail: false,
      });
      return new QueueHeartbeat({
        heartbeatId: heartbeat.heartbeatId,
        leaseId: heartbeat.leaseId,
        queueName: this.queueName,
        owner: heartbeat.owner,
        expiresAt,
        metadata: heartbeat.metadata,
      });
    } finally {
      await queue.close().catch(() => undefined);
    }
  }

  async stop(heartbeat: QueueHeartbeat): Promise<boolean> {
    const queue = new Queue(`${this.queueName}:heartbeats`, {
      connection: resolveBullMQConnection(),
    });
    try {
      const job = await queue.getJob(heartbeat.leaseId);
      if (!job) return false;
      await job.remove();
      return true;
    } finally {
      await queue.close().catch(() => undefined);
    }
  }

  isExpired(heartbeat: QueueHeartbeat): boolean {
    return Date.parse(heartbeat.expiresAt) <= Date.now();
  }
}
