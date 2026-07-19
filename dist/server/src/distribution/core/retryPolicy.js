import { DistributionError } from "./distributionError.js";
import { DistributionStatus } from "./distributionStatus.js";
export class RetryPolicy {
    maxAttempts;
    baseDelayMs;
    maxDelayMs;
    jitterRatio;
    now;
    random;
    constructor(options = {}) {
        this.maxAttempts = options.maxAttempts ?? 5;
        this.baseDelayMs = options.baseDelayMs ?? 15_000;
        this.maxDelayMs = options.maxDelayMs ?? 30 * 60_000;
        this.jitterRatio = options.jitterRatio ?? 0.2;
        this.now = options.now ?? (() => new Date());
        this.random = options.random ?? Math.random;
    }
    canRetry(error, attempt) {
        const normalized = this.normalize(error);
        return normalized.retryable && attempt < this.maxAttempts;
    }
    decide(error, attempt) {
        const normalized = this.normalize(error);
        if (!normalized.retryable) {
            return { action: "NO_RETRY", reason: normalized.code, attempt };
        }
        if (attempt >= this.maxAttempts) {
            return { action: "DEAD_LETTER", reason: "MAX_ATTEMPTS_EXCEEDED", attempt };
        }
        const delayMs = this.delayForAttempt(attempt);
        return {
            action: "RETRY",
            delayMs,
            retryAt: new Date(this.now().getTime() + delayMs),
            attempt,
        };
    }
    delayForAttempt(attempt) {
        const exponent = Math.max(0, attempt);
        const rawDelay = Math.min(this.maxDelayMs, this.baseDelayMs * 2 ** exponent);
        const jitter = rawDelay * this.jitterRatio * (this.random() - 0.5) * 2;
        return Math.max(0, Math.round(rawDelay + jitter));
    }
    normalize(error) {
        if (error instanceof DistributionError)
            return error;
        return DistributionError.fromUnknown(error, {
            code: "UNEXPECTED_ERROR",
            status: DistributionStatus.FAILED,
            retryable: true,
        });
    }
}
