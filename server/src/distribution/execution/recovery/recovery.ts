import type { ExecutionCheckpoint, ExecutionFailureCategory } from "../types";
import type { DistributionExecutionContext } from "../types/context";

export interface ResumeStrategy {
  shouldResume(error: unknown, context: DistributionExecutionContext, checkpoint: ExecutionCheckpoint | null): boolean;
}

export interface RetryStrategy {
  shouldRetry(error: unknown, context: DistributionExecutionContext, checkpoint: ExecutionCheckpoint | null): boolean;
}

export interface FailureClassifier {
  classify(error: unknown): ExecutionFailureCategory;
}

export class RecoveryDecision {
  readonly category: ExecutionFailureCategory;
  readonly retry: boolean;
  readonly resume: boolean;
  readonly pause: boolean;
  readonly fatal: boolean;
  readonly message: string;
  readonly checkpointId: string | null;
  readonly retryAfterStage: string | null;
  readonly manualInterventionRequired: boolean;

  constructor(input: {
    category: ExecutionFailureCategory;
    retry?: boolean;
    resume?: boolean;
    pause?: boolean;
    fatal?: boolean;
    message: string;
    checkpointId?: string | null;
    retryAfterStage?: string | null;
    manualInterventionRequired?: boolean;
  }) {
    this.category = input.category;
    this.retry = input.retry ?? false;
    this.resume = input.resume ?? false;
    this.pause = input.pause ?? false;
    this.fatal = input.fatal ?? false;
    this.message = input.message.trim();
    this.checkpointId = input.checkpointId ?? null;
    this.retryAfterStage = input.retryAfterStage ?? null;
    this.manualInterventionRequired = input.manualInterventionRequired ?? false;
    Object.freeze(this);
  }
}

export class StandardFailureClassifier implements FailureClassifier {
  classify(error: unknown): ExecutionFailureCategory {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      if (message.includes("cancel")) {
        return "Fatal";
      }
      if (message.includes("retry")) {
        return "Retryable";
      }
      if (message.includes("recover")) {
        return "Recoverable";
      }
    }
    return "Manual Intervention";
  }
}

export class StandardResumeStrategy implements ResumeStrategy {
  shouldResume(_error: unknown, _context: DistributionExecutionContext, checkpoint: ExecutionCheckpoint | null): boolean {
    return checkpoint != null;
  }
}

export class StandardRetryStrategy implements RetryStrategy {
  shouldRetry(_error: unknown, context: DistributionExecutionContext, checkpoint: ExecutionCheckpoint | null): boolean {
    return checkpoint != null && context.retryCount < 3;
  }
}

export class RecoveryCoordinator {
  constructor(
    private readonly failureClassifier: FailureClassifier,
    private readonly resumeStrategy: ResumeStrategy,
    private readonly retryStrategy: RetryStrategy,
  ) {}

  recover(error: unknown, context: DistributionExecutionContext, checkpoint: ExecutionCheckpoint | null): RecoveryDecision {
    const category = this.failureClassifier.classify(error);
    const retry = category === "Retryable" && this.retryStrategy.shouldRetry(error, context, checkpoint);
    const resume = category === "Recoverable" && this.resumeStrategy.shouldResume(error, context, checkpoint);
    const pause = category === "Manual Intervention";
    const fatal = category === "Fatal";
    return new RecoveryDecision({
      category,
      retry,
      resume,
      pause,
      fatal,
      message: error instanceof Error ? error.message : "Execution failure",
      checkpointId: checkpoint?.checkpointId ?? null,
      retryAfterStage: checkpoint?.stage ?? null,
      manualInterventionRequired: pause,
    });
  }
}
