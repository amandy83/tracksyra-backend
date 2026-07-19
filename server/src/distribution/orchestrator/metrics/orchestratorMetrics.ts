export interface OrchestratorMetrics {
  increment(metric: string, value?: number, tags?: Readonly<Record<string, string | number | boolean>>): void;
  observe(metric: string, value: number, tags?: Readonly<Record<string, string | number | boolean>>): void;
  gauge(metric: string, value: number, tags?: Readonly<Record<string, string | number | boolean>>): void;
}

