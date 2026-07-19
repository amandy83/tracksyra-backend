export interface WorkerMetrics {
  increment(metric: string, value?: number, tags?: Readonly<Record<string, string | number | boolean>>): void;
  observe(metric: string, value: number, tags?: Readonly<Record<string, string | number | boolean>>): void;
  gauge(metric: string, value: number, tags?: Readonly<Record<string, string | number | boolean>>): void;
}

export class WorkerStatistics {
  readonly workerId: string;
  readonly executionId: string;
  readonly executionDurationMs: number;
  readonly retryCount: number;
  readonly checkpointCount: number;
  readonly recoveryCount: number;
  readonly failureCount: number;
  readonly heartbeatLatencyMs: number;
  readonly utilization: number;

  constructor(input: {
    workerId: string;
    executionId: string;
    executionDurationMs: number;
    retryCount?: number;
    checkpointCount?: number;
    recoveryCount?: number;
    failureCount?: number;
    heartbeatLatencyMs?: number;
    utilization?: number;
  }) {
    this.workerId = input.workerId.trim();
    this.executionId = input.executionId.trim();
    this.executionDurationMs = input.executionDurationMs;
    this.retryCount = input.retryCount ?? 0;
    this.checkpointCount = input.checkpointCount ?? 0;
    this.recoveryCount = input.recoveryCount ?? 0;
    this.failureCount = input.failureCount ?? 0;
    this.heartbeatLatencyMs = input.heartbeatLatencyMs ?? 0;
    this.utilization = input.utilization ?? 0;
    if (!this.workerId || !this.executionId) {
      throw new Error("WorkerStatistics requires non-empty identifiers");
    }
    Object.freeze(this);
  }
}

