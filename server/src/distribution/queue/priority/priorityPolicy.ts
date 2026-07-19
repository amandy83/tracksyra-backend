import type { QueueJob } from "../jobs/queueJob";
import type { QueuePriorityLevel } from "../types/queueTypes";

export interface PriorityPolicy {
  resolve(job: QueueJob): QueuePriorityLevel;
  compare(left: QueueJob, right: QueueJob): number;
}

