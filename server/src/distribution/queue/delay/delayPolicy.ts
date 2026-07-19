import type { QueueJob } from "../jobs/queueJob";
import type { QueueSchedulingPolicyName } from "../types/queueTypes";

export interface DelayPolicy {
  readonly name: QueueSchedulingPolicyName;
  delayMs(job: QueueJob): number;
  scheduledAt(job: QueueJob): string | null;
}

