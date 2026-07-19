import type { QueueMetricsCollector } from "../metrics/queueMetrics";
import type { QueueMetadata } from "../types/queueIntegrationTypes";
import { QueueStatistics } from "../types/queueIntegrationTypes";
import { Queue } from "bullmq";
import { resolveBullMQConnection, createBullMQQueueConfiguration } from "./bullmqSupport";

export class BullMQQueueMetricsCollector implements QueueMetricsCollector {
  private readonly counters = new Map<string, number>();
  private readonly gauges = new Map<string, number>();

  increment(metric: string, value = 1, tags?: Readonly<Record<string, string | number | boolean>>): void {
    void tags;
    this.counters.set(metric, (this.counters.get(metric) ?? 0) + value);
  }

  observe(metric: string, value: number, tags?: Readonly<Record<string, string | number | boolean>>): void {
    void tags;
    this.gauges.set(metric, value);
  }

  gauge(metric: string, value: number, tags?: Readonly<Record<string, string | number | boolean>>): void {
    void tags;
    this.gauges.set(metric, value);
  }

  async snapshot(queueName: string, metadata?: QueueMetadata): Promise<QueueStatistics> {
    const configuration = createBullMQQueueConfiguration(queueName, metadata);
    const queue = new Queue(queueName, {
      connection: resolveBullMQConnection(),
      prefix: configuration.namespace ?? undefined,
    });
    try {
      const counts = await queue.getJobCounts("waiting", "delayed", "active", "failed", "completed");
      return new QueueStatistics({
        queueName,
        adapter: "BullMQ",
        enqueued: (counts.waiting ?? 0) + (counts.delayed ?? 0),
        dequeued: counts.active ?? 0,
        processed: counts.completed ?? 0,
        failed: counts.failed ?? 0,
        retried: Number(this.counters.get(`retry:${queueName}`) ?? 0),
        deadLettered: Number(this.counters.get(`deadletter:${queueName}`) ?? 0),
        queueDepth: (counts.waiting ?? 0) + (counts.delayed ?? 0),
        averageLatencyMs: Number(this.gauges.get(`latency:${queueName}`) ?? 0),
        workerUtilization: Number(this.gauges.get(`utilization:${queueName}`) ?? 0),
        metadata: metadata ?? {},
      });
    } finally {
      await queue.close();
    }
  }
}
