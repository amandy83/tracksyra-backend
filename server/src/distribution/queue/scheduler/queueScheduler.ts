import type { QueueJob } from "../jobs/queueJob";
import type { QueueSchedulingPolicyName } from "../types/queueTypes";

export interface QueueScheduler {
  readonly policy: QueueSchedulingPolicyName;
  schedule(job: QueueJob): string | null;
  next(job: QueueJob): string | null;
}

