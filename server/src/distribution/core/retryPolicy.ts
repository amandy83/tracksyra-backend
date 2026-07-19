import { DistributionError } from "./distributionError";
import { DistributionStatus } from "./distributionStatus";

export type RetryPolicyDecision =
  | { action: "RETRY"; retryAt: Date; delayMs: number; attempt: number }
  | { action: "DEAD_LETTER"; reason: string; attempt: number }
  | { action: "NO_RETRY"; reason: string; attempt: number };

export type RetryPolicyOptions = {
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  jitterRatio?: number;
  now?: () => Date;
  random?: () => number;
};

export class RetryPolicy {
  private readonly maxAttempts: number;
  private readonly baseDelayMs: number;
  private readonly maxDelayMs: number;
  private readonly jitterRatio: number;
  private readonly now: () => Date;
  private readonly random: () => number;

  constructor(options: RetryPolicyOptions = {}) {
    this.maxAttempts = options.maxAttempts ?? 5;
    this.baseDelayMs = options.baseDelayMs ?? 15_000;
    this.maxDelayMs = options.maxDelayMs ?? 30 * 60_000;
    this.jitterRatio = options.jitterRatio ?? 0.2;
    this.now = options.now ?? (() => new Date());
    this.random = options.random ?? Math.random;
  }

  canRetry(error: DistributionError | unknown, attempt: number): boolean {
    const normalized = this.normalize(error);
    return normalized.retryable && attempt < this.maxAttempts;
  }

  decide(error: DistributionError | unknown, attempt: number): RetryPolicyDecision {
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

  private delayForAttempt(attempt: number): number {
    const exponent = Math.max(0, attempt);
    const rawDelay = Math.min(this.maxDelayMs, this.baseDelayMs * 2 ** exponent);
    const jitter = rawDelay * this.jitterRatio * (this.random() - 0.5) * 2;
    return Math.max(0, Math.round(rawDelay + jitter));
  }

  private normalize(error: DistributionError | unknown): DistributionError {
    if (error instanceof DistributionError) return error;
    return DistributionError.fromUnknown(error, {
      code: "UNEXPECTED_ERROR",
      status: DistributionStatus.FAILED,
      retryable: true,
    });
  }
}

