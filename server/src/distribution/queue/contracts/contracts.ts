import type { QueueJob } from "../jobs/queueJob";
import type { QueueMessage } from "../messages/queueMessage";
import type { QueueBatch } from "../batch/queueBatch";
import type { DeadLetterQueue } from "../deadletter/deadLetter";
import type { QueueDispatcher, JobDispatcher, MessageDispatcher, StageDispatcher } from "../dispatch/queueDispatch";
import type { DelayPolicy } from "../delay/delayPolicy";
import type { PriorityPolicy } from "../priority/priorityPolicy";
import type { QueueScheduler } from "../scheduler/queueScheduler";
import type { ReservationPolicy } from "../reservation/reservationPolicy";
import type { QueueSerializer } from "../serialization/queueSerializer";
import type { QueueMetrics } from "../metrics/queueMetrics";
import type { RetryPolicy } from "../retry/retryPolicy";
import type { QueueRegistry } from "../registry/queueRegistry";
import type { QueueLease } from "../lease/queueLease";

export interface QueueProducer<TJob extends QueueJob = QueueJob> {
  enqueue(job: TJob): Promise<void>;
}

export interface QueueConsumer<TMessage extends QueueMessage = QueueMessage> {
  consume(handler: (message: TMessage) => Promise<void> | void): Promise<void>;
}

export interface QueueAdapter {
  readonly producers: QueueProducer;
  readonly consumers: QueueConsumer;
  readonly dispatcher: QueueDispatcher;
  readonly scheduler: QueueScheduler;
  readonly registry: QueueRegistry;
  readonly serializer: QueueSerializer;
  readonly metrics: QueueMetrics;
}

export interface QueueBatchDispatcher {
  dispatch(batch: QueueBatch): Promise<void> | void;
}

export interface QueueLeaseManager {
  acquire(resource: string, owner: string): QueueLease | null;
  renew(lease: QueueLease): QueueLease | null;
  release(lease: QueueLease): boolean;
}

export interface QueueSubscription {
  readonly name: string;
  readonly priorityPolicy: PriorityPolicy;
  readonly delayPolicy: DelayPolicy;
  readonly retryPolicy: RetryPolicy;
  readonly reservationPolicy: ReservationPolicy;
  readonly deadLetterQueue: DeadLetterQueue;
}

