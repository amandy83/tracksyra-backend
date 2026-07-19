const backoffMs = [10_000, 30_000, 120_000, 600_000];
const retryableCodes = new Set(["NETWORK_ERROR", "RATE_LIMIT_ERROR", "PROVIDER_ERROR", "DISTRIBUTION_WORKER_ERROR"]);
const nonRetryableCodes = new Set(["AUTH_ERROR", "VALIDATION_ERROR"]);
export class RetryEngine {
    maxRetries;
    now;
    constructor(options = {}) {
        this.maxRetries = options.maxRetries ?? backoffMs.length;
        this.now = options.now ?? (() => new Date());
    }
    classify(error) {
        if (nonRetryableCodes.has(error.errorCode))
            return { ...error, retryable: false };
        if (retryableCodes.has(error.errorCode))
            return { ...error, retryable: true };
        return { ...error, errorCode: "PROVIDER_ERROR", retryable: true };
    }
    decide(error, attempts) {
        const classified = this.classify(error);
        if (!classified.retryable)
            return { action: "NO_RETRY", reason: classified.errorCode };
        if (attempts >= this.maxRetries)
            return { action: "DEAD_LETTER", reason: "MAX_RETRIES_EXCEEDED" };
        const delayMs = backoffMs[Math.min(attempts, backoffMs.length - 1)];
        return { action: "RETRY", delayMs, retryAt: new Date(this.now().getTime() + delayMs) };
    }
}
