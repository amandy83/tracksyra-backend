export interface MetricsCollector {
  increment(metric: string, value?: number, tags?: Readonly<Record<string, string | number | boolean>>): void;
  observe(metric: string, value: number, tags?: Readonly<Record<string, string | number | boolean>>): void;
}

export class InMemoryMetricsCollector implements MetricsCollector {
  readonly counters = new Map<string, number>();
  readonly observations = new Map<string, number[]>();

  increment(metric: string, value = 1): void {
    this.counters.set(metric, (this.counters.get(metric) ?? 0) + value);
  }

  observe(metric: string, value: number): void {
    const current = this.observations.get(metric) ?? [];
    current.push(value);
    this.observations.set(metric, current);
  }
}

export class HealthReporter {
  constructor(private readonly metrics: MetricsCollector) {}

  report(component: string, healthy: boolean, details: Readonly<Record<string, unknown>> = {}): void {
    this.metrics.increment("health_reports", 1, { component, healthy });
    void details;
  }
}

export class PerformanceRecorder {
  constructor(private readonly metrics: MetricsCollector) {}

  record(metric: string, durationMs: number): void {
    this.metrics.observe(metric, durationMs);
  }
}

