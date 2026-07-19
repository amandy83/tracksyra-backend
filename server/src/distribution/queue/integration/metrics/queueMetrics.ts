import type { QueueStatistics, QueueMetadata } from "../types/queueIntegrationTypes";

export interface QueueMetricsCollector {
  increment(metric: string, value?: number, tags?: Readonly<Record<string, string | number | boolean>>): void;
  observe(metric: string, value: number, tags?: Readonly<Record<string, string | number | boolean>>): void;
  gauge(metric: string, value: number, tags?: Readonly<Record<string, string | number | boolean>>): void;
  snapshot(queueName: string, metadata?: QueueMetadata): Promise<QueueStatistics> | QueueStatistics;
}
