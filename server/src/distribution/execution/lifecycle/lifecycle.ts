import type { DistributionExecutionContext } from "../types/context";
import type { ExecutionStageName } from "../types";

export class ExecutionTransition {
  readonly from: ExecutionStageName;
  readonly to: ExecutionStageName;
  readonly requestedAt: string;
  readonly reason: string | null;

  constructor(input: { from: ExecutionStageName; to: ExecutionStageName; requestedAt?: string; reason?: string | null }) {
    this.from = input.from;
    this.to = input.to;
    this.requestedAt = input.requestedAt ?? new Date().toISOString();
    this.reason = input.reason ?? null;
    Object.freeze(this);
  }
}

export class ExecutionLifecycle {
  readonly executionId: string;
  readonly transitions: readonly ExecutionTransition[];

  constructor(input: { executionId: string; transitions?: readonly ExecutionTransition[] }) {
    this.executionId = input.executionId.trim();
    if (!this.executionId) {
      throw new Error("executionId must not be empty");
    }
    this.transitions = Object.freeze([...(input.transitions ?? [])]);
    Object.freeze(this);
  }

  transition(from: ExecutionStageName, to: ExecutionStageName, reason?: string | null): ExecutionLifecycle {
    return new ExecutionLifecycle({
      executionId: this.executionId,
      transitions: [...this.transitions, new ExecutionTransition({ from, to, reason })],
    });
  }
}

export class JobLifecycle extends ExecutionLifecycle {
  start(context: DistributionExecutionContext): JobLifecycle {
    return new JobLifecycle({
      executionId: this.executionId,
      transitions: [...this.transitions, new ExecutionTransition({ from: context.stage, to: context.stage })],
    });
  }
}

export class StageLifecycle extends ExecutionLifecycle {
  advance(context: DistributionExecutionContext, nextStage: ExecutionStageName): StageLifecycle {
    return new StageLifecycle({
      executionId: this.executionId,
      transitions: [...this.transitions, new ExecutionTransition({ from: context.stage, to: nextStage })],
    });
  }
}

