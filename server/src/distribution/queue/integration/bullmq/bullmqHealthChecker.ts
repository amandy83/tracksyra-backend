import { Queue } from "bullmq";
import type { QueueHealthChecker } from "../health/queueHealth";
import type { QueueConfiguration } from "../types/queueIntegrationTypes";
import { QueueHealthStatus } from "../types/queueIntegrationTypes";
import { resolveBullMQConnection } from "./bullmqSupport";

export class BullMQQueueHealthChecker implements QueueHealthChecker {
  async check(configuration: QueueConfiguration): Promise<QueueHealthStatus> {
    return this.inspect(configuration.queueName, configuration);
  }

  async probe(queueName: string): Promise<QueueHealthStatus> {
    return this.inspect(queueName);
  }

  private async inspect(queueName: string, configuration?: QueueConfiguration): Promise<QueueHealthStatus> {
    const queue = new Queue(queueName, {
      connection: resolveBullMQConnection(),
      prefix: configuration?.namespace ?? undefined,
    });
    try {
      const counts = await queue.getJobCounts("waiting", "delayed", "active", "failed", "completed", "paused");
      const failed = counts.failed ?? 0;
      const state = failed > 0 ? "Degraded" : "Healthy";
      return new QueueHealthStatus({
        statusId: `${queueName}:health`,
        adapter: "BullMQ",
        state,
        healthy: state === "Healthy",
        details: counts,
        metadata: configuration?.metadata ?? {},
      });
    } catch (error) {
      return new QueueHealthStatus({
        statusId: `${queueName}:health:error`,
        adapter: "BullMQ",
        state: "Unhealthy",
        healthy: false,
        details: {
          error: error instanceof Error ? error.message : String(error),
        },
        metadata: configuration?.metadata ?? {},
      });
    } finally {
      await queue.close().catch(() => undefined);
    }
  }
}
