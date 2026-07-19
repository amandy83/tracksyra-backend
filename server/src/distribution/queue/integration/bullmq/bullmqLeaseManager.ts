import { Queue } from "bullmq";
import type { LeaseManager } from "../lease/queueLease";
import { QueueLease } from "../types/queueIntegrationTypes";
import { resolveBullMQConnection } from "./bullmqSupport";

export class BullMQLeaseManager implements LeaseManager {
  constructor(
    private readonly queueName: string,
    private readonly leaseDurationMs: number,
  ) {}

  async acquire(resource: string, owner: string): Promise<QueueLease | null> {
    const queue = new Queue(`${this.queueName}:leases`, {
      connection: resolveBullMQConnection(),
    });
    try {
      const existing = await queue.getJob(resource);
      if (existing) return null;

      const expiresAt = new Date(Date.now() + this.leaseDurationMs).toISOString();
      await queue.add("lease", { resource, owner, expiresAt }, {
        jobId: resource,
        delay: this.leaseDurationMs,
        removeOnComplete: false,
        removeOnFail: false,
      });

      return new QueueLease({
        leaseId: resource,
        resource,
        owner,
        expiresAt,
        metadata: { queueName: this.queueName },
      });
    } finally {
      await queue.close().catch(() => undefined);
    }
  }

  async renew(lease: QueueLease): Promise<QueueLease | null> {
    const released = await this.release(lease);
    if (!released) return null;
    return this.acquire(lease.resource, lease.owner);
  }

  async release(lease: QueueLease): Promise<boolean> {
    const queue = new Queue(`${this.queueName}:leases`, {
      connection: resolveBullMQConnection(),
    });
    try {
      const job = await queue.getJob(lease.leaseId);
      if (!job) return false;
      await job.remove();
      return true;
    } finally {
      await queue.close().catch(() => undefined);
    }
  }

  async expire(lease: QueueLease): Promise<boolean> {
    if (Date.parse(lease.expiresAt) > Date.now()) return false;
    return this.release(lease);
  }
}
