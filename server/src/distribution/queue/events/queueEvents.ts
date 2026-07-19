import type { QueueJob } from "../jobs/queueJob";
import type { QueueDeadLetterReason, QueuePayload, QueuePriorityLevel } from "../types/queueTypes";
import type { QueueMessage } from "../messages/queueMessage";
import type { QueueLease } from "../lease/queueLease";

export type QueueEventType =
  | "JobQueued"
  | "JobDispatched"
  | "JobReserved"
  | "JobStarted"
  | "JobCompleted"
  | "JobFailed"
  | "JobRetried"
  | "JobCancelled"
  | "JobExpired"
  | "DeadLetterCreated";

export type QueueEvent = Readonly<{
  type: QueueEventType;
  queueId: string;
  occurredAt: string;
  payload: Readonly<Record<string, unknown>>;
}>;

export type JobQueuedEvent = QueueEvent & {
  type: "JobQueued";
  payload: Readonly<{
    jobId: string;
    priority: QueuePriorityLevel;
  }>;
};

export type DeadLetterCreatedEvent = QueueEvent & {
  type: "DeadLetterCreated";
  payload: Readonly<{
    reason: QueueDeadLetterReason;
    jobId: string;
    messageId: string;
  }>;
};

export interface QueueEventPublisher {
  publish(event: QueueEvent): Promise<void> | void;
}

