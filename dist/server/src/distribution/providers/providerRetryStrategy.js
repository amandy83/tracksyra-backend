import { ProviderError } from "./providerError.js";
export class ExponentialProviderRetryStrategy {
    maxAttempts;
    baseDelayMs;
    maxDelayMs;
    jitterRatio;
    random;
    constructor(options = {}) {
        this.maxAttempts = options.maxAttempts ?? 5;
        this.baseDelayMs = options.baseDelayMs ?? 15_000;
        this.maxDelayMs = options.maxDelayMs ?? 30 * 60_000;
        this.jitterRatio = options.jitterRatio ?? 0.2;
        this.random = options.random ?? Math.random;
    }
    shouldRetry(error, attempt) {
        const providerError = ProviderError.fromUnknown(error, "provider");
        return providerError.retryable && attempt < this.maxAttempts;
    }
    nextDelayMs(attempt, error) {
        const rawDelay = Math.min(this.maxDelayMs, this.baseDelayMs * 2 ** Math.max(0, attempt));
        const jitter = rawDelay * this.jitterRatio * (this.random() - 0.5) * 2;
        return Math.max(0, Math.round(rawDelay + jitter));
    }
    decide(error, attempt, now = () => new Date()) {
        const providerError = ProviderError.fromUnknown(error, "provider");
        if (!this.shouldRetry(providerError, attempt)) {
            return { action: "STOP", reason: providerError.retryable ? "MAX_ATTEMPTS_EXCEEDED" : providerError.code };
        }
        const delayMs = this.nextDelayMs(attempt, providerError);
        return { action: "RETRY", delayMs, retryAt: new Date(now().getTime() + delayMs) };
    }
    nextRetryAt(error, attempt, _job) {
        const providerError = ProviderError.fromUnknown(error, "provider");
        if (!this.shouldRetry(providerError, attempt)) {
            return null;
        }
        return new Date(Date.now() + this.nextDelayMs(attempt, providerError)).toISOString();
    }
}
