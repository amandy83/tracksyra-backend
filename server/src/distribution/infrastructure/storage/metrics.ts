import type { MetricsCollector } from "../metrics/metrics";

export interface StorageMetrics {
  increment(metric: string, value?: number, tags?: Readonly<Record<string, string | number | boolean>>): void;
  observe(metric: string, value: number, tags?: Readonly<Record<string, string | number | boolean>>): void;
}

export class DefaultStorageMetrics implements StorageMetrics {
  constructor(private readonly metrics: MetricsCollector | null = null) {}

  increment(metric: string, value = 1, tags: Readonly<Record<string, string | number | boolean>> = {}): void {
    this.metrics?.increment(metric, value, tags);
  }

  observe(metric: string, value: number, tags: Readonly<Record<string, string | number | boolean>> = {}): void {
    this.metrics?.observe(metric, value, tags);
  }
}
