export class WorkerHeartbeat {
  readonly heartbeatId: string;
  readonly workerId: string;
  readonly executionId: string;
  readonly recordedAt: string;
  readonly nextDueAt: string | null;
  readonly latencyMs: number;

  constructor(input: {
    heartbeatId: string;
    workerId: string;
    executionId: string;
    recordedAt?: string;
    nextDueAt?: string | null;
    latencyMs: number;
  }) {
    this.heartbeatId = input.heartbeatId.trim();
    this.workerId = input.workerId.trim();
    this.executionId = input.executionId.trim();
    this.recordedAt = input.recordedAt ?? new Date().toISOString();
    this.nextDueAt = input.nextDueAt ?? null;
    this.latencyMs = input.latencyMs;
    if (!this.heartbeatId || !this.workerId || !this.executionId) {
      throw new Error("WorkerHeartbeat requires non-empty identifiers");
    }
    if (!Number.isFinite(this.latencyMs) || this.latencyMs < 0) {
      throw new Error("WorkerHeartbeat.latencyMs must be non-negative");
    }
    Object.freeze(this);
  }
}

export interface HeartbeatManager {
  start(workerId: string, executionId: string): WorkerHeartbeat;
  renew(workerId: string, executionId: string): WorkerHeartbeat;
  detectMissed(referenceTime?: string): readonly WorkerHeartbeat[];
  expire(workerId: string, executionId: string): readonly WorkerHeartbeat[];
}

