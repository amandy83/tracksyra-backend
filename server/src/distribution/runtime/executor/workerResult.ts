import type { DistributionExecutionResult } from "../../execution/types";
import type { WorkerFailureCategory, WorkerLifecycleState } from "../types/workerTypes";

export class WorkerFailure {
  readonly category: WorkerFailureCategory;
  readonly message: string;
  readonly retryable: boolean;
  readonly occurredAt: string;
  readonly checkpointId: string | null;
  readonly metadata: Readonly<Record<string, unknown>>;

  constructor(input: {
    category: WorkerFailureCategory;
    message: string;
    retryable: boolean;
    occurredAt?: string;
    checkpointId?: string | null;
    metadata?: Readonly<Record<string, unknown>>;
  }) {
    this.category = input.category;
    this.message = input.message.trim();
    this.retryable = input.retryable;
    this.occurredAt = input.occurredAt ?? new Date().toISOString();
    this.checkpointId = input.checkpointId ?? null;
    this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
    Object.freeze(this);
  }
}

export class WorkerResult {
  readonly success: boolean;
  readonly lifecycle: WorkerLifecycleState;
  readonly completedAt: string;
  readonly checkpointId: string | null;
  readonly executionResult: DistributionExecutionResult | null;
  readonly failure: WorkerFailure | null;
  readonly warnings: readonly string[];
  readonly metadata: Readonly<Record<string, unknown>>;

  constructor(input: {
    success: boolean;
    lifecycle: WorkerLifecycleState;
    completedAt?: string;
    checkpointId?: string | null;
    executionResult?: DistributionExecutionResult | null;
    failure?: WorkerFailure | null;
    warnings?: readonly string[];
    metadata?: Readonly<Record<string, unknown>>;
  }) {
    this.success = input.success;
    this.lifecycle = input.lifecycle;
    this.completedAt = input.completedAt ?? new Date().toISOString();
    this.checkpointId = input.checkpointId ?? null;
    this.executionResult = input.executionResult ?? null;
    this.failure = input.failure ?? null;
    this.warnings = Object.freeze([...(input.warnings ?? [])]);
    this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
    Object.freeze(this);
  }
}

