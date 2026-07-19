import type { DistributionExecutionContext } from "../../execution/types";
import type { DistributionExecutionResult } from "../../execution/types";

export class WorkerExecution {
  readonly executionId: string;
  readonly workerId: string;
  readonly releaseId: string;
  readonly stage: string;
  readonly executionContext: DistributionExecutionContext;
  readonly createdAt: string;
  readonly startedAt: string | null;
  readonly completedAt: string | null;
  readonly retryCount: number;
  readonly metadata: Readonly<Record<string, unknown>>;

  constructor(input: {
    executionId: string;
    workerId: string;
    releaseId: string;
    stage: string;
    executionContext: DistributionExecutionContext;
    createdAt?: string;
    startedAt?: string | null;
    completedAt?: string | null;
    retryCount?: number;
    metadata?: Readonly<Record<string, unknown>>;
  }) {
    this.executionId = input.executionId.trim();
    this.workerId = input.workerId.trim();
    this.releaseId = input.releaseId.trim();
    this.stage = input.stage.trim();
    this.executionContext = input.executionContext;
    this.createdAt = input.createdAt ?? new Date().toISOString();
    this.startedAt = input.startedAt ?? null;
    this.completedAt = input.completedAt ?? null;
    this.retryCount = input.retryCount ?? 0;
    this.metadata = Object.freeze({ ...(input.metadata ?? {}) });

    if (!this.executionId || !this.workerId || !this.releaseId || !this.stage) {
      throw new Error("WorkerExecution requires non-empty identifiers");
    }
    if (!Number.isInteger(this.retryCount) || this.retryCount < 0) {
      throw new Error("WorkerExecution.retryCount must be a non-negative integer");
    }
    Object.freeze(this);
  }

  withResult(result: DistributionExecutionResult): WorkerExecution {
    return new WorkerExecution({
      executionId: this.executionId,
      workerId: this.workerId,
      releaseId: this.releaseId,
      stage: this.stage,
      executionContext: this.executionContext,
      createdAt: this.createdAt,
      startedAt: this.startedAt ?? new Date().toISOString(),
      completedAt: result.success || result.failure ? new Date().toISOString() : this.completedAt,
      retryCount: this.retryCount,
      metadata: {
        ...this.metadata,
        result,
      },
    });
  }
}

