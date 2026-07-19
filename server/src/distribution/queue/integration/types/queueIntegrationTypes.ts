import type { AuthenticationSnapshot } from "../../../partner-credentials";

export type QueueAdapterName =
  | "BullMQ"
  | "RabbitMQ"
  | "AWSSQS"
  | "GooglePubSub"
  | "AzureServiceBus"
  | "Custom";

export type QueuePriorityLevel = "Critical" | "High" | "Normal" | "Low" | "Background";

export type QueueRetryPolicyName =
  | "Immediate"
  | "Linear"
  | "Exponential"
  | "ExponentialWithJitter"
  | "ManualOnly"
  | "NeverRetry";

export type QueueHealthState = "Healthy" | "Degraded" | "Unhealthy" | "Unknown";

export type QueueMetadata = Readonly<Record<string, unknown>>;

export type QueueMessageHeaders = Readonly<Record<string, string>>;

export type QueueMessageAttributes = Readonly<Record<string, string | number | boolean | null>>;

export type QueueTracing = Readonly<{
  traceId: string;
  correlationId: string;
  parentSpanId: string | null;
  spanId: string;
}>;

function freezeMetadata<T extends QueueMetadata>(value: T): T {
  return Object.freeze({ ...value }) as T;
}

export class QueueLease<TMetadata extends QueueMetadata = QueueMetadata> {
  readonly leaseId: string;
  readonly resource: string;
  readonly owner: string;
  readonly acquiredAt: string;
  readonly expiresAt: string;
  readonly renewCount: number;
  readonly metadata: TMetadata;

  constructor(input: {
    leaseId: string;
    resource: string;
    owner: string;
    acquiredAt?: string;
    expiresAt: string;
    renewCount?: number;
    metadata?: TMetadata;
  }) {
    this.leaseId = input.leaseId.trim();
    this.resource = input.resource.trim();
    this.owner = input.owner.trim();
    this.acquiredAt = input.acquiredAt ?? new Date().toISOString();
    this.expiresAt = input.expiresAt;
    this.renewCount = input.renewCount ?? 0;
    this.metadata = freezeMetadata((input.metadata ?? {}) as TMetadata);
    if (!this.leaseId || !this.resource || !this.owner || !this.expiresAt) {
      throw new Error("QueueLease requires non-empty values");
    }
    if (!Number.isInteger(this.renewCount) || this.renewCount < 0) {
      throw new Error("QueueLease.renewCount must be a non-negative integer");
    }
    Object.freeze(this);
  }
}

export class RetryContext<TMetadata extends QueueMetadata = QueueMetadata> {
  readonly attempt: number;
  readonly maxAttempts: number;
  readonly policy: QueueRetryPolicyName;
  readonly nextRetryAt: string | null;
  readonly lastError: string | null;
  readonly metadata: TMetadata;

  constructor(input: {
    attempt: number;
    maxAttempts: number;
    policy: QueueRetryPolicyName;
    nextRetryAt?: string | null;
    lastError?: string | null;
    metadata?: TMetadata;
  }) {
    this.attempt = input.attempt;
    this.maxAttempts = input.maxAttempts;
    this.policy = input.policy;
    this.nextRetryAt = input.nextRetryAt ?? null;
    this.lastError = input.lastError ?? null;
    this.metadata = freezeMetadata((input.metadata ?? {}) as TMetadata);
    if (!Number.isInteger(this.attempt) || this.attempt < 0) {
      throw new Error("RetryContext.attempt must be a non-negative integer");
    }
    if (!Number.isInteger(this.maxAttempts) || this.maxAttempts < 0) {
      throw new Error("RetryContext.maxAttempts must be a non-negative integer");
    }
    Object.freeze(this);
  }
}

export class QueueHeartbeat<TMetadata extends QueueMetadata = QueueMetadata> {
  readonly heartbeatId: string;
  readonly leaseId: string;
  readonly queueName: string;
  readonly owner: string;
  readonly occurredAt: string;
  readonly expiresAt: string;
  readonly metadata: TMetadata;

  constructor(input: {
    heartbeatId: string;
    leaseId: string;
    queueName: string;
    owner: string;
    occurredAt?: string;
    expiresAt: string;
    metadata?: TMetadata;
  }) {
    this.heartbeatId = input.heartbeatId.trim();
    this.leaseId = input.leaseId.trim();
    this.queueName = input.queueName.trim();
    this.owner = input.owner.trim();
    this.occurredAt = input.occurredAt ?? new Date().toISOString();
    this.expiresAt = input.expiresAt;
    this.metadata = freezeMetadata((input.metadata ?? {}) as TMetadata);
    if (!this.heartbeatId || !this.leaseId || !this.queueName || !this.owner || !this.expiresAt) {
      throw new Error("QueueHeartbeat requires non-empty values");
    }
    Object.freeze(this);
  }
}

export class QueueCheckpoint<TMetadata extends QueueMetadata = QueueMetadata> {
  readonly checkpointId: string;
  readonly executionId: string;
  readonly queueName: string;
  readonly stage: string;
  readonly createdAt: string;
  readonly completedStages: readonly string[];
  readonly retryCount: number;
  readonly metadata: TMetadata;

  constructor(input: {
    checkpointId: string;
    executionId: string;
    queueName: string;
    stage: string;
    createdAt?: string;
    completedStages?: readonly string[];
    retryCount?: number;
    metadata?: TMetadata;
  }) {
    this.checkpointId = input.checkpointId.trim();
    this.executionId = input.executionId.trim();
    this.queueName = input.queueName.trim();
    this.stage = input.stage.trim();
    this.createdAt = input.createdAt ?? new Date().toISOString();
    this.completedStages = Object.freeze([...(input.completedStages ?? [])]);
    this.retryCount = input.retryCount ?? 0;
    this.metadata = freezeMetadata((input.metadata ?? {}) as TMetadata);
    if (!this.checkpointId || !this.executionId || !this.queueName || !this.stage) {
      throw new Error("QueueCheckpoint requires non-empty values");
    }
    if (!Number.isInteger(this.retryCount) || this.retryCount < 0) {
      throw new Error("QueueCheckpoint.retryCount must be a non-negative integer");
    }
    Object.freeze(this);
  }
}

export class QueueEnvelope<TBody = unknown, TMetadata extends QueueMetadata = QueueMetadata> {
  readonly messageId: string;
  readonly type: string;
  readonly body: TBody;
  readonly headers: QueueMessageHeaders;
  readonly attributes: QueueMessageAttributes;
  readonly timestamp: string;
  readonly lease: QueueLease<TMetadata> | null;
  readonly retryContext: RetryContext<TMetadata> | null;
  readonly tracing: QueueTracing;
  readonly metadata: TMetadata;
  readonly deliveryAttempt: number;
  readonly scheduledAt: string | null;

  constructor(input: {
    messageId: string;
    type: string;
    body: TBody;
    headers?: QueueMessageHeaders;
    attributes?: QueueMessageAttributes;
    timestamp?: string;
    lease?: QueueLease<TMetadata> | null;
    retryContext?: RetryContext<TMetadata> | null;
    tracing: QueueTracing;
    metadata?: TMetadata;
    deliveryAttempt?: number;
    scheduledAt?: string | null;
  }) {
    this.messageId = input.messageId.trim();
    this.type = input.type.trim();
    this.body = input.body;
    this.headers = Object.freeze({ ...(input.headers ?? {}) });
    this.attributes = Object.freeze({ ...(input.attributes ?? {}) });
    this.timestamp = input.timestamp ?? new Date().toISOString();
    this.lease = input.lease ?? null;
    this.retryContext = input.retryContext ?? null;
    this.tracing = Object.freeze({ ...input.tracing });
    this.metadata = freezeMetadata((input.metadata ?? {}) as TMetadata);
    this.deliveryAttempt = input.deliveryAttempt ?? 0;
    this.scheduledAt = input.scheduledAt ?? null;
    if (!this.messageId || !this.type) {
      throw new Error("QueueEnvelope requires messageId and type");
    }
    if (!Number.isInteger(this.deliveryAttempt) || this.deliveryAttempt < 0) {
      throw new Error("QueueEnvelope.deliveryAttempt must be a non-negative integer");
    }
    if (!this.tracing.traceId || !this.tracing.correlationId || !this.tracing.spanId) {
      throw new Error("QueueEnvelope.tracing requires identifiers");
    }
    Object.freeze(this);
  }
}

export class QueueExecutionContext<TPayload extends QueueMetadata = QueueMetadata, TMetadata extends QueueMetadata = QueueMetadata> {
  readonly executionId: string;
  readonly releaseId: string;
  readonly jobId: string;
  readonly queueName: string;
  readonly adapter: QueueAdapterName;
  readonly stage: string;
  readonly payload: TPayload;
  readonly metadata: TMetadata;
  readonly lease: QueueLease<TMetadata> | null;
  readonly checkpoint: QueueCheckpoint<TMetadata> | null;
  readonly heartbeat: QueueHeartbeat<TMetadata> | null;
  readonly authentication: AuthenticationSnapshot | null;
  readonly retryCount: number;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly tracing: QueueTracing;

  constructor(input: {
    executionId: string;
    releaseId: string;
    jobId: string;
    queueName: string;
    adapter: QueueAdapterName;
    stage: string;
    payload: TPayload;
    metadata?: TMetadata;
    lease?: QueueLease<TMetadata> | null;
    checkpoint?: QueueCheckpoint<TMetadata> | null;
    heartbeat?: QueueHeartbeat<TMetadata> | null;
    authentication?: AuthenticationSnapshot | null;
    retryCount?: number;
    createdAt?: string;
    updatedAt?: string;
    tracing: QueueTracing;
  }) {
    this.executionId = input.executionId.trim();
    this.releaseId = input.releaseId.trim();
    this.jobId = input.jobId.trim();
    this.queueName = input.queueName.trim();
    this.adapter = input.adapter;
    this.stage = input.stage.trim();
    this.payload = input.payload;
    this.metadata = freezeMetadata((input.metadata ?? {}) as TMetadata);
    this.lease = input.lease ?? null;
    this.checkpoint = input.checkpoint ?? null;
    this.heartbeat = input.heartbeat ?? null;
    this.authentication = input.authentication ?? null;
    this.retryCount = input.retryCount ?? 0;
    this.createdAt = input.createdAt ?? new Date().toISOString();
    this.updatedAt = input.updatedAt ?? this.createdAt;
    this.tracing = Object.freeze({ ...input.tracing });
    if (!this.executionId || !this.releaseId || !this.jobId || !this.queueName || !this.stage) {
      throw new Error("QueueExecutionContext requires non-empty identifiers");
    }
    if (!Number.isInteger(this.retryCount) || this.retryCount < 0) {
      throw new Error("QueueExecutionContext.retryCount must be a non-negative integer");
    }
    Object.freeze(this);
  }
}

export class QueueExecutionResult<TMetadata extends QueueMetadata = QueueMetadata> {
  readonly success: boolean;
  readonly failure: boolean;
  readonly completedStage: string | null;
  readonly executionTime: number;
  readonly nextStage: string | null;
  readonly checkpoint: QueueCheckpoint<TMetadata> | null;
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
  readonly metadata: TMetadata;

  constructor(input: {
    success: boolean;
    failure: boolean;
    completedStage?: string | null;
    executionTime: number;
    nextStage?: string | null;
    checkpoint?: QueueCheckpoint<TMetadata> | null;
    errors?: readonly string[];
    warnings?: readonly string[];
    metadata?: TMetadata;
  }) {
    this.success = input.success;
    this.failure = input.failure;
    this.completedStage = input.completedStage ?? null;
    this.executionTime = input.executionTime;
    this.nextStage = input.nextStage ?? null;
    this.checkpoint = input.checkpoint ?? null;
    this.errors = Object.freeze([...(input.errors ?? [])]);
    this.warnings = Object.freeze([...(input.warnings ?? [])]);
    this.metadata = freezeMetadata((input.metadata ?? {}) as TMetadata);
    if (!this.success && !this.failure) {
      throw new Error("QueueExecutionResult must be success or failure");
    }
    if (this.success && this.failure) {
      throw new Error("QueueExecutionResult cannot be both success and failure");
    }
    if (!Number.isFinite(this.executionTime) || this.executionTime < 0) {
      throw new Error("QueueExecutionResult.executionTime must be non-negative");
    }
    Object.freeze(this);
  }
}

export class DeadLetterMessage<TBody = unknown, TMetadata extends QueueMetadata = QueueMetadata> {
  readonly messageId: string;
  readonly queueName: string;
  readonly reason: string;
  readonly body: TBody;
  readonly retryContext: RetryContext<TMetadata> | null;
  readonly failedAt: string;
  readonly metadata: TMetadata;

  constructor(input: {
    messageId: string;
    queueName: string;
    reason: string;
    body: TBody;
    retryContext?: RetryContext<TMetadata> | null;
    failedAt?: string;
    metadata?: TMetadata;
  }) {
    this.messageId = input.messageId.trim();
    this.queueName = input.queueName.trim();
    this.reason = input.reason.trim();
    this.body = input.body;
    this.retryContext = input.retryContext ?? null;
    this.failedAt = input.failedAt ?? new Date().toISOString();
    this.metadata = freezeMetadata((input.metadata ?? {}) as TMetadata);
    if (!this.messageId || !this.queueName || !this.reason) {
      throw new Error("DeadLetterMessage requires non-empty values");
    }
    Object.freeze(this);
  }
}

export class QueueHealthStatus<TMetadata extends QueueMetadata = QueueMetadata> {
  readonly statusId: string;
  readonly adapter: QueueAdapterName;
  readonly state: QueueHealthState;
  readonly healthy: boolean;
  readonly checkedAt: string;
  readonly details: Readonly<Record<string, unknown>>;
  readonly metadata: TMetadata;

  constructor(input: {
    statusId: string;
    adapter: QueueAdapterName;
    state: QueueHealthState;
    healthy: boolean;
    checkedAt?: string;
    details?: Readonly<Record<string, unknown>>;
    metadata?: TMetadata;
  }) {
    this.statusId = input.statusId.trim();
    this.adapter = input.adapter;
    this.state = input.state;
    this.healthy = input.healthy;
    this.checkedAt = input.checkedAt ?? new Date().toISOString();
    this.details = Object.freeze({ ...(input.details ?? {}) });
    this.metadata = freezeMetadata((input.metadata ?? {}) as TMetadata);
    if (!this.statusId) {
      throw new Error("QueueHealthStatus.statusId must not be empty");
    }
    Object.freeze(this);
  }
}

export class QueueStatistics<TMetadata extends QueueMetadata = QueueMetadata> {
  readonly queueName: string;
  readonly adapter: QueueAdapterName;
  readonly enqueued: number;
  readonly dequeued: number;
  readonly processed: number;
  readonly failed: number;
  readonly retried: number;
  readonly deadLettered: number;
  readonly queueDepth: number;
  readonly averageLatencyMs: number;
  readonly workerUtilization: number;
  readonly sampledAt: string;
  readonly metadata: TMetadata;

  constructor(input: {
    queueName: string;
    adapter: QueueAdapterName;
    enqueued?: number;
    dequeued?: number;
    processed?: number;
    failed?: number;
    retried?: number;
    deadLettered?: number;
    queueDepth?: number;
    averageLatencyMs?: number;
    workerUtilization?: number;
    sampledAt?: string;
    metadata?: TMetadata;
  }) {
    this.queueName = input.queueName.trim();
    this.adapter = input.adapter;
    this.enqueued = input.enqueued ?? 0;
    this.dequeued = input.dequeued ?? 0;
    this.processed = input.processed ?? 0;
    this.failed = input.failed ?? 0;
    this.retried = input.retried ?? 0;
    this.deadLettered = input.deadLettered ?? 0;
    this.queueDepth = input.queueDepth ?? 0;
    this.averageLatencyMs = input.averageLatencyMs ?? 0;
    this.workerUtilization = input.workerUtilization ?? 0;
    this.sampledAt = input.sampledAt ?? new Date().toISOString();
    this.metadata = freezeMetadata((input.metadata ?? {}) as TMetadata);
    const values = [
      this.enqueued,
      this.dequeued,
      this.processed,
      this.failed,
      this.retried,
      this.deadLettered,
      this.queueDepth,
      this.averageLatencyMs,
      this.workerUtilization,
    ];
    if (!this.queueName) {
      throw new Error("QueueStatistics.queueName must not be empty");
    }
    if (values.some((value) => !Number.isFinite(value) || value < 0)) {
      throw new Error("QueueStatistics numeric values must be non-negative");
    }
    Object.freeze(this);
  }
}

export class QueueConfiguration<TMetadata extends QueueMetadata = QueueMetadata> {
  readonly configurationId: string;
  readonly adapter: QueueAdapterName;
  readonly queueName: string;
  readonly namespace: string | null;
  readonly region: string | null;
  readonly enabled: boolean;
  readonly retryPolicy: QueueRetryPolicyName;
  readonly leaseDurationMs: number;
  readonly heartbeatIntervalMs: number;
  readonly pollIntervalMs: number;
  readonly concurrency: number;
  readonly metadata: TMetadata;

  constructor(input: {
    configurationId: string;
    adapter: QueueAdapterName;
    queueName: string;
    namespace?: string | null;
    region?: string | null;
    enabled?: boolean;
    retryPolicy?: QueueRetryPolicyName;
    leaseDurationMs?: number;
    heartbeatIntervalMs?: number;
    pollIntervalMs?: number;
    concurrency?: number;
    metadata?: TMetadata;
  }) {
    this.configurationId = input.configurationId.trim();
    this.adapter = input.adapter;
    this.queueName = input.queueName.trim();
    this.namespace = input.namespace ?? null;
    this.region = input.region ?? null;
    this.enabled = input.enabled ?? true;
    this.retryPolicy = input.retryPolicy ?? "Exponential";
    this.leaseDurationMs = input.leaseDurationMs ?? 0;
    this.heartbeatIntervalMs = input.heartbeatIntervalMs ?? 0;
    this.pollIntervalMs = input.pollIntervalMs ?? 0;
    this.concurrency = input.concurrency ?? 1;
    this.metadata = freezeMetadata((input.metadata ?? {}) as TMetadata);
    if (!this.configurationId || !this.queueName) {
      throw new Error("QueueConfiguration requires non-empty identifiers");
    }
    const values = [this.leaseDurationMs, this.heartbeatIntervalMs, this.pollIntervalMs, this.concurrency];
    if (values.some((value) => !Number.isFinite(value) || value < 0)) {
      throw new Error("QueueConfiguration numeric values must be non-negative");
    }
    Object.freeze(this);
  }
}
