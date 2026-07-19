import type { QueueJobType, QueueMessageAttributes, QueuePayload, QueuePriorityLevel } from "../types/queueTypes";

export class QueueJob<TPayload extends QueuePayload = QueuePayload, TMetadata extends QueuePayload = QueuePayload> {
  readonly jobId: string;
  readonly executionId: string;
  readonly releaseId: string;
  readonly stage: string;
  readonly priority: QueuePriorityLevel;
  readonly payload: TPayload;
  readonly metadata: TMetadata;
  readonly retryCount: number;
  readonly createdAt: string;
  readonly scheduledAt: string | null;
  readonly idempotencyKey: string;
  readonly correlationId: string;
  readonly jobType: QueueJobType;

  constructor(input: {
    jobId: string;
    executionId: string;
    releaseId: string;
    stage: string;
    priority: QueuePriorityLevel;
    payload: TPayload;
    metadata?: TMetadata;
    retryCount?: number;
    createdAt?: string;
    scheduledAt?: string | null;
    idempotencyKey: string;
    correlationId: string;
    jobType: QueueJobType;
  }) {
    this.jobId = input.jobId.trim();
    this.executionId = input.executionId.trim();
    this.releaseId = input.releaseId.trim();
    this.stage = input.stage.trim();
    this.priority = input.priority;
    this.payload = input.payload;
    this.metadata = (input.metadata ?? {}) as TMetadata;
    this.retryCount = input.retryCount ?? 0;
    this.createdAt = input.createdAt ?? new Date().toISOString();
    this.scheduledAt = input.scheduledAt ?? null;
    this.idempotencyKey = input.idempotencyKey.trim();
    this.correlationId = input.correlationId.trim();
    this.jobType = input.jobType;

    if (!this.jobId || !this.executionId || !this.releaseId || !this.stage || !this.idempotencyKey || !this.correlationId) {
      throw new Error("QueueJob requires non-empty identifiers");
    }
    if (!Number.isInteger(this.retryCount) || this.retryCount < 0) {
      throw new Error("QueueJob.retryCount must be a non-negative integer");
    }

    Object.freeze(this);
  }
}

export type QueueJobAttributes = QueueMessageAttributes;

