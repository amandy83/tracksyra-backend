import type { WorkerConfiguration, WorkerStatistics } from "../types/workerIntegrationTypes";

export interface WorkerMetricsCollector {
  increment(metric: string, value?: number, tags?: Readonly<Record<string, string | number | boolean>>): void;
  observe(metric: string, value: number, tags?: Readonly<Record<string, string | number | boolean>>): void;
  gauge(metric: string, value: number, tags?: Readonly<Record<string, string | number | boolean>>): void;
  snapshot(workerId: string): Promise<WorkerStatistics> | WorkerStatistics;
  summary(configuration?: WorkerConfiguration): Promise<WorkerStatistics> | WorkerStatistics;
}
