import type { QueueBatchPolicyName, QueuePayload } from "../types/queueTypes";
import type { QueueJob } from "../jobs/queueJob";

export class QueueBatch<TJob extends QueueJob = QueueJob, TMetadata extends QueuePayload = QueuePayload> {
  readonly batchId: string;
  readonly policy: QueueBatchPolicyName;
  readonly jobs: readonly TJob[];
  readonly metadata: TMetadata;
  readonly createdAt: string;

  constructor(input: {
    batchId: string;
    policy: QueueBatchPolicyName;
    jobs: readonly TJob[];
    metadata?: TMetadata;
    createdAt?: string;
  }) {
    this.batchId = input.batchId.trim();
    this.policy = input.policy;
    this.jobs = Object.freeze([...(input.jobs ?? [])]);
    this.metadata = (input.metadata ?? {}) as TMetadata;
    this.createdAt = input.createdAt ?? new Date().toISOString();
    if (!this.batchId) {
      throw new Error("QueueBatch.batchId must not be empty");
    }
    Object.freeze(this);
  }
}

