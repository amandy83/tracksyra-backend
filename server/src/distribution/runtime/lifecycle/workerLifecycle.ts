import type { WorkerContext } from "../context/workerContext";

export class WorkerLifecycle {
  readonly workerId: string;
  readonly executionId: string;
  readonly state: import("../types/workerTypes").WorkerLifecycleState;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly completedAt: string | null;
  readonly metadata: Readonly<Record<string, unknown>>;

  constructor(input: {
    workerId: string;
    executionId: string;
    state: import("../types/workerTypes").WorkerLifecycleState;
    createdAt?: string;
    updatedAt?: string;
    completedAt?: string | null;
    metadata?: Readonly<Record<string, unknown>>;
  }) {
    this.workerId = input.workerId.trim();
    this.executionId = input.executionId.trim();
    this.state = input.state;
    this.createdAt = input.createdAt ?? new Date().toISOString();
    this.updatedAt = input.updatedAt ?? this.createdAt;
    this.completedAt = input.completedAt ?? null;
    this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
    if (!this.workerId || !this.executionId) {
      throw new Error("WorkerLifecycle requires non-empty identifiers");
    }
    Object.freeze(this);
  }
}

export interface WorkerLifecycleManager {
  create(context: WorkerContext): WorkerLifecycle;
  reserve(context: WorkerContext): WorkerLifecycle;
  start(context: WorkerContext): WorkerLifecycle;
  run(context: WorkerContext): WorkerLifecycle;
  checkpoint(context: WorkerContext): WorkerLifecycle;
  complete(context: WorkerContext): WorkerLifecycle;
  fail(context: WorkerContext): WorkerLifecycle;
  cancel(context: WorkerContext): WorkerLifecycle;
  recover(context: WorkerContext): WorkerLifecycle;
}

