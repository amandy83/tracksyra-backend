import type { QueueDeadLetterReason } from "../types/queueTypes";
import type { QueueMessage } from "../messages/queueMessage";
import type { QueueJob } from "../jobs/queueJob";

export interface DeadLetterQueue<TMessage extends QueueMessage = QueueMessage, TJob extends QueueJob = QueueJob> {
  enqueue(input: {
    reason: QueueDeadLetterReason;
    message: TMessage;
    job: TJob;
    error: string;
    failedAt: string;
  }): Promise<void> | void;
}

