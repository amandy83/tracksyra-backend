import { Queue } from "bullmq";
import { QueueLease } from "../types/queueIntegrationTypes.js";
import { resolveBullMQConnection } from "./bullmqSupport.js";
export class BullMQLeaseManager {
    queueName;
    leaseDurationMs;
    constructor(queueName, leaseDurationMs) {
        this.queueName = queueName;
        this.leaseDurationMs = leaseDurationMs;
    }
    async acquire(resource, owner) {
        const queue = new Queue(`${this.queueName}:leases`, {
            connection: resolveBullMQConnection(),
        });
        try {
            const existing = await queue.getJob(resource);
            if (existing)
                return null;
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
        }
        finally {
            await queue.close().catch(() => undefined);
        }
    }
    async renew(lease) {
        const released = await this.release(lease);
        if (!released)
            return null;
        return this.acquire(lease.resource, lease.owner);
    }
    async release(lease) {
        const queue = new Queue(`${this.queueName}:leases`, {
            connection: resolveBullMQConnection(),
        });
        try {
            const job = await queue.getJob(lease.leaseId);
            if (!job)
                return false;
            await job.remove();
            return true;
        }
        finally {
            await queue.close().catch(() => undefined);
        }
    }
    async expire(lease) {
        if (Date.parse(lease.expiresAt) > Date.now())
            return false;
        return this.release(lease);
    }
}
