import type { ExecutionCheckpoint, ExecutionStageName } from "./types";

export class DistributionExecutionResult {
  readonly success: boolean;
  readonly failure: boolean;
  readonly completedStage: ExecutionStageName | null;
  readonly executionTime: number;
  readonly nextStage: ExecutionStageName | null;
  readonly checkpoint: ExecutionCheckpoint | null;
  readonly errors: readonly string[];
  readonly warnings: readonly string[];

  constructor(input: {
    success: boolean;
    failure: boolean;
    completedStage?: ExecutionStageName | null;
    executionTime: number;
    nextStage?: ExecutionStageName | null;
    checkpoint?: ExecutionCheckpoint | null;
    errors?: readonly string[];
    warnings?: readonly string[];
  }) {
    this.success = input.success;
    this.failure = input.failure;
    this.completedStage = input.completedStage ?? null;
    this.executionTime = input.executionTime;
    this.nextStage = input.nextStage ?? null;
    this.checkpoint = input.checkpoint ?? null;
    this.errors = Object.freeze([...(input.errors ?? [])]);
    this.warnings = Object.freeze([...(input.warnings ?? [])]);
    if (!this.success && !this.failure) {
      throw new Error("Execution result must be either success or failure");
    }
    if (this.success && this.failure) {
      throw new Error("Execution result cannot be both success and failure");
    }
    if (!Number.isFinite(this.executionTime) || this.executionTime < 0) {
      throw new Error("executionTime must be a non-negative finite number");
    }
    Object.freeze(this);
  }

  static succeeded(input: {
    completedStage?: ExecutionStageName | null;
    executionTime: number;
    nextStage?: ExecutionStageName | null;
    checkpoint?: ExecutionCheckpoint | null;
    warnings?: readonly string[];
  }): DistributionExecutionResult {
    return new DistributionExecutionResult({
      success: true,
      failure: false,
      ...input,
      errors: [],
    });
  }

  static failed(input: {
    completedStage?: ExecutionStageName | null;
    executionTime: number;
    nextStage?: ExecutionStageName | null;
    checkpoint?: ExecutionCheckpoint | null;
    errors: readonly string[];
    warnings?: readonly string[];
  }): DistributionExecutionResult {
    return new DistributionExecutionResult({
      success: false,
      failure: true,
      ...input,
    });
  }
}

