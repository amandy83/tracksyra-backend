export class ExecutionTransition {
    from;
    to;
    requestedAt;
    reason;
    constructor(input) {
        this.from = input.from;
        this.to = input.to;
        this.requestedAt = input.requestedAt ?? new Date().toISOString();
        this.reason = input.reason ?? null;
        Object.freeze(this);
    }
}
export class ExecutionLifecycle {
    executionId;
    transitions;
    constructor(input) {
        this.executionId = input.executionId.trim();
        if (!this.executionId) {
            throw new Error("executionId must not be empty");
        }
        this.transitions = Object.freeze([...(input.transitions ?? [])]);
        Object.freeze(this);
    }
    transition(from, to, reason) {
        return new ExecutionLifecycle({
            executionId: this.executionId,
            transitions: [...this.transitions, new ExecutionTransition({ from, to, reason })],
        });
    }
}
export class JobLifecycle extends ExecutionLifecycle {
    start(context) {
        return new JobLifecycle({
            executionId: this.executionId,
            transitions: [...this.transitions, new ExecutionTransition({ from: context.stage, to: context.stage })],
        });
    }
}
export class StageLifecycle extends ExecutionLifecycle {
    advance(context, nextStage) {
        return new StageLifecycle({
            executionId: this.executionId,
            transitions: [...this.transitions, new ExecutionTransition({ from: context.stage, to: nextStage })],
        });
    }
}
