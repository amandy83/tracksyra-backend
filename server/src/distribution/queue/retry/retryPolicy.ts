import type { QueueJob } from "../jobs/queueJob";
import type { QueueRetryPolicyName } from "../types/queueTypes";

export interface RetryPolicy {
  readonly name: QueueRetryPolicyName;
  readonly maxAttempts: number;
  canRetry(job: QueueJob, error?: unknown): boolean;
  nextDelayMs(job: QueueJob, error?: unknown): number | null;
}

