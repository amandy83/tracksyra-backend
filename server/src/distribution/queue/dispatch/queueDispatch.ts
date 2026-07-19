import type { QueueJob } from "../jobs/queueJob";
import type { QueueMessage } from "../messages/queueMessage";

export interface JobDispatcher {
  dispatch(job: QueueJob): Promise<void> | void;
}

export interface MessageDispatcher {
  dispatch(message: QueueMessage): Promise<void> | void;
}

export interface StageDispatcher {
  dispatch(stage: string, job: QueueJob): Promise<void> | void;
}

export interface QueueDispatcher {
  dispatch(job: QueueJob): Promise<void> | void;
}

