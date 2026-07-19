import type { QueueJob } from "../jobs/queueJob";

export interface ReservationPolicy {
  canReserve(job: QueueJob): boolean;
  canRelease(job: QueueJob): boolean;
  canExtend(job: QueueJob): boolean;
}

