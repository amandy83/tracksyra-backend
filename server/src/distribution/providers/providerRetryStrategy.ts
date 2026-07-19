import { ProviderError } from "./providerError";

export type ProviderRetryDecision =
  | { action: "RETRY"; delayMs: number; retryAt: Date }
  | { action: "STOP"; reason: string };

export interface ProviderRetryStrategy {
  readonly maxAttempts: number;
  shouldRetry(error: unknown, attempt: number): boolean;
  nextDelayMs(attempt: number, error: unknown): number;
  decide(error: unknown, attempt: number, now?: () => Date): ProviderRetryDecision;
}

export type ProviderRetryStrategyOptions = {
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  jitterRatio?: number;
  random?: () => number;
};

export class ExponentialProviderRetryStrategy implements ProviderRetryStrategy {
  readonly maxAttempts: number;
  private readonly baseDelayMs: number;
  private readonly maxDelayMs: number;
  private readonly jitterRatio: number;
  private readonly random: () => number;

  constructor(options: ProviderRetryStrategyOptions = {}) {
    this.maxAttempts = options.maxAttempts ?? 5;
    this.baseDelayMs = options.baseDelayMs ?? 15_000;
    this.maxDelayMs = options.maxDelayMs ?? 30 * 60_000;
    this.jitterRatio = options.jitterRatio ?? 0.2;
    this.random = options.random ?? Math.random;
  }

  shouldRetry(error: unknown, attempt: number): boolean {
    const providerError = ProviderError.fromUnknown(error, "provider");
    return providerError.retryable && attempt < this.maxAttempts;
  }

  nextDelayMs(attempt: number, error: unknown): number {
    const rawDelay = Math.min(this.maxDelayMs, this.baseDelayMs * 2 ** Math.max(0, attempt));
    const jitter = rawDelay * this.jitterRatio * (this.random() - 0.5) * 2;
    return Math.max(0, Math.round(rawDelay + jitter));
  }

  decide(error: unknown, attempt: number, now: () => Date = () => new Date()): ProviderRetryDecision {
    const providerError = ProviderError.fromUnknown(error, "provider");
    if (!this.shouldRetry(providerError, attempt)) {
      return { action: "STOP", reason: providerError.retryable ? "MAX_ATTEMPTS_EXCEEDED" : providerError.code };
    }
    const delayMs = this.nextDelayMs(attempt, providerError);
    return { action: "RETRY", delayMs, retryAt: new Date(now().getTime() + delayMs) };
  }

  nextRetryAt(error: unknown, attempt: number, _job?: unknown): string | null {
    const providerError = ProviderError.fromUnknown(error, "provider");
    if (!this.shouldRetry(providerError, attempt)) {
      return null;
    }
    return new Date(Date.now() + this.nextDelayMs(attempt, providerError)).toISOString();
  }
}
