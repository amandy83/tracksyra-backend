import type { QueueMessageAttributes, QueueMessageHeaders, QueuePayload, QueueTracing } from "../types/queueTypes";
import type { QueueLease } from "../lease/queueLease";
import type { RetryPolicy } from "../retry/retryPolicy";

export class QueueMessage<TBody = unknown> {
  readonly messageId: string;
  readonly type: string;
  readonly body: TBody;
  readonly headers: QueueMessageHeaders;
  readonly attributes: QueueMessageAttributes;
  readonly timestamp: string;

  constructor(input: {
    messageId: string;
    type: string;
    body: TBody;
    headers?: QueueMessageHeaders;
    attributes?: QueueMessageAttributes;
    timestamp?: string;
  }) {
    this.messageId = input.messageId.trim();
    this.type = input.type.trim();
    this.body = input.body;
    this.headers = Object.freeze({ ...(input.headers ?? {}) });
    this.attributes = Object.freeze({ ...(input.attributes ?? {}) });
    this.timestamp = input.timestamp ?? new Date().toISOString();
    if (!this.messageId || !this.type) {
      throw new Error("QueueMessage requires non-empty messageId and type");
    }
    Object.freeze(this);
  }
}

export class QueueEnvelope<TBody = unknown> {
  readonly message: QueueMessage<TBody>;
  readonly lease: QueueLease | null;
  readonly retryPolicy: RetryPolicy | null;
  readonly deliveryAttempt: number;
  readonly tracing: QueueTracing;

  constructor(input: {
    message: QueueMessage<TBody>;
    lease?: QueueLease | null;
    retryPolicy?: RetryPolicy | null;
    deliveryAttempt?: number;
    tracing: QueueTracing;
  }) {
    this.message = input.message;
    this.lease = input.lease ?? null;
    this.retryPolicy = input.retryPolicy ?? null;
    this.deliveryAttempt = input.deliveryAttempt ?? 0;
    this.tracing = Object.freeze({ ...input.tracing });
    if (!Number.isInteger(this.deliveryAttempt) || this.deliveryAttempt < 0) {
      throw new Error("QueueEnvelope.deliveryAttempt must be a non-negative integer");
    }
    Object.freeze(this);
  }
}

