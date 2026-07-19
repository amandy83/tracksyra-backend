import type { DistributionExecutionContext } from "../../execution/types";
import type { WorkerCheckpoint } from "../checkpoint/workerCheckpoint";
import type { WorkerLease } from "../lease/workerLease";
import type { WorkerLifecycleState } from "../types/workerTypes";

export class WorkerContext {
  readonly workerId: string;
  readonly workerType: string;
  readonly executionId: string;
  readonly releaseId: string;
  readonly lifecycle: WorkerLifecycleState;
  readonly executionContext: DistributionExecutionContext;
  readonly lease: WorkerLease | null;
  readonly checkpoint: WorkerCheckpoint | null;
  readonly retryCount: number;
  readonly metadata: Readonly<Record<string, unknown>>;
  readonly createdAt: string;
  readonly updatedAt: string;

  constructor(input: {
    workerId: string;
    workerType: string;
    executionId: string;
    releaseId: string;
    lifecycle: WorkerLifecycleState;
    executionContext: DistributionExecutionContext;
    lease?: WorkerLease | null;
    checkpoint?: WorkerCheckpoint | null;
    retryCount?: number;
    metadata?: Readonly<Record<string, unknown>>;
    createdAt?: string;
    updatedAt?: string;
  }) {
    this.workerId = input.workerId.trim();
    this.workerType = input.workerType.trim();
    this.executionId = input.executionId.trim();
    this.releaseId = input.releaseId.trim();
    this.lifecycle = input.lifecycle;
    this.executionContext = input.executionContext;
    this.lease = input.lease ?? null;
    this.checkpoint = input.checkpoint ?? null;
    this.retryCount = input.retryCount ?? 0;
    this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
    this.createdAt = input.createdAt ?? new Date().toISOString();
    this.updatedAt = input.updatedAt ?? this.createdAt;

    if (!this.workerId || !this.workerType || !this.executionId || !this.releaseId) {
      throw new Error("WorkerContext requires non-empty identifiers");
    }
    if (!Number.isInteger(this.retryCount) || this.retryCount < 0) {
      throw new Error("WorkerContext.retryCount must be a non-negative integer");
    }
    Object.freeze(this);
  }

  withLifecycle(lifecycle: WorkerLifecycleState): WorkerContext {
    return new WorkerContext({
      workerId: this.workerId,
      workerType: this.workerType,
      executionId: this.executionId,
      releaseId: this.releaseId,
      lifecycle,
      executionContext: this.executionContext,
      lease: this.lease,
      checkpoint: this.checkpoint,
      retryCount: this.retryCount,
      metadata: this.metadata,
      createdAt: this.createdAt,
      updatedAt: new Date().toISOString(),
    });
  }

  withCheckpoint(checkpoint: WorkerCheckpoint | null): WorkerContext {
    return new WorkerContext({
      workerId: this.workerId,
      workerType: this.workerType,
      executionId: this.executionId,
      releaseId: this.releaseId,
      lifecycle: this.lifecycle,
      executionContext: this.executionContext,
      lease: this.lease,
      checkpoint,
      retryCount: this.retryCount,
      metadata: this.metadata,
      createdAt: this.createdAt,
      updatedAt: new Date().toISOString(),
    });
  }

  withLease(lease: WorkerLease | null): WorkerContext {
    return new WorkerContext({
      workerId: this.workerId,
      workerType: this.workerType,
      executionId: this.executionId,
      releaseId: this.releaseId,
      lifecycle: this.lifecycle,
      executionContext: this.executionContext,
      lease,
      checkpoint: this.checkpoint,
      retryCount: this.retryCount,
      metadata: this.metadata,
      createdAt: this.createdAt,
      updatedAt: new Date().toISOString(),
    });
  }

  withRetryCount(retryCount: number): WorkerContext {
    return new WorkerContext({
      workerId: this.workerId,
      workerType: this.workerType,
      executionId: this.executionId,
      releaseId: this.releaseId,
      lifecycle: this.lifecycle,
      executionContext: this.executionContext,
      lease: this.lease,
      checkpoint: this.checkpoint,
      retryCount,
      metadata: this.metadata,
      createdAt: this.createdAt,
      updatedAt: new Date().toISOString(),
    });
  }
}

