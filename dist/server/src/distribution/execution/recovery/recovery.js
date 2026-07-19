export class RecoveryDecision {
    category;
    retry;
    resume;
    pause;
    fatal;
    message;
    checkpointId;
    retryAfterStage;
    manualInterventionRequired;
    constructor(input) {
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
export class StandardFailureClassifier {
    classify(error) {
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
export class StandardResumeStrategy {
    shouldResume(_error, _context, checkpoint) {
        return checkpoint != null;
    }
}
export class StandardRetryStrategy {
    shouldRetry(_error, context, checkpoint) {
        return checkpoint != null && context.retryCount < 3;
    }
}
export class RecoveryCoordinator {
    failureClassifier;
    resumeStrategy;
    retryStrategy;
    constructor(failureClassifier, resumeStrategy, retryStrategy) {
        this.failureClassifier = failureClassifier;
        this.resumeStrategy = resumeStrategy;
        this.retryStrategy = retryStrategy;
    }
    recover(error, context, checkpoint) {
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
