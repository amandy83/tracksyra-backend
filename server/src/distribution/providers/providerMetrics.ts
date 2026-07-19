export type ProviderMetricTag = Readonly<Record<string, string | number | boolean>>;

export type ProviderMetricPoint = Readonly<{
  name: string;
  value: number;
  unit: "count" | "ms" | "bytes" | "ratio";
  tags: ProviderMetricTag;
  recordedAt: Date;
}>;

export interface ProviderMetrics {
  increment(name: string, value?: number, tags?: ProviderMetricTag): void;
  gauge(name: string, value: number, tags?: ProviderMetricTag): void;
  timing(name: string, valueMs: number, tags?: ProviderMetricTag): void;
  record(point: ProviderMetricPoint): void;
  snapshot(): readonly ProviderMetricPoint[];
}

export class InMemoryProviderMetrics implements ProviderMetrics {
  private readonly points: ProviderMetricPoint[] = [];

  increment(name: string, value = 1, tags: ProviderMetricTag = {}): void {
    this.record({ name, value, unit: "count", tags, recordedAt: new Date() });
  }

  gauge(name: string, value: number, tags: ProviderMetricTag = {}): void {
    this.record({ name, value, unit: "count", tags, recordedAt: new Date() });
  }

  timing(name: string, valueMs: number, tags: ProviderMetricTag = {}): void {
    this.record({ name, value: valueMs, unit: "ms", tags, recordedAt: new Date() });
  }

  record(point: ProviderMetricPoint): void {
    this.points.push(point);
  }

  snapshot(): readonly ProviderMetricPoint[] {
    return [...this.points];
  }
}

