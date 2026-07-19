function freezeMetadata(value) {
    return Object.freeze({ ...value });
}
export class QueueLease {
    leaseId;
    resource;
    owner;
    acquiredAt;
    expiresAt;
    renewCount;
    metadata;
    constructor(input) {
        this.leaseId = input.leaseId.trim();
        this.resource = input.resource.trim();
        this.owner = input.owner.trim();
        this.acquiredAt = input.acquiredAt ?? new Date().toISOString();
        this.expiresAt = input.expiresAt;
        this.renewCount = input.renewCount ?? 0;
        this.metadata = freezeMetadata((input.metadata ?? {}));
        if (!this.leaseId || !this.resource || !this.owner || !this.expiresAt) {
            throw new Error("QueueLease requires non-empty values");
        }
        if (!Number.isInteger(this.renewCount) || this.renewCount < 0) {
            throw new Error("QueueLease.renewCount must be a non-negative integer");
        }
        Object.freeze(this);
    }
}
export class RetryContext {
    attempt;
    maxAttempts;
    policy;
    nextRetryAt;
    lastError;
    metadata;
    constructor(input) {
        this.attempt = input.attempt;
        this.maxAttempts = input.maxAttempts;
        this.policy = input.policy;
        this.nextRetryAt = input.nextRetryAt ?? null;
        this.lastError = input.lastError ?? null;
        this.metadata = freezeMetadata((input.metadata ?? {}));
        if (!Number.isInteger(this.attempt) || this.attempt < 0) {
            throw new Error("RetryContext.attempt must be a non-negative integer");
        }
        if (!Number.isInteger(this.maxAttempts) || this.maxAttempts < 0) {
            throw new Error("RetryContext.maxAttempts must be a non-negative integer");
        }
        Object.freeze(this);
    }
}
export class QueueHeartbeat {
    heartbeatId;
    leaseId;
    queueName;
    owner;
    occurredAt;
    expiresAt;
    metadata;
    constructor(input) {
        this.heartbeatId = input.heartbeatId.trim();
        this.leaseId = input.leaseId.trim();
        this.queueName = input.queueName.trim();
        this.owner = input.owner.trim();
        this.occurredAt = input.occurredAt ?? new Date().toISOString();
        this.expiresAt = input.expiresAt;
        this.metadata = freezeMetadata((input.metadata ?? {}));
        if (!this.heartbeatId || !this.leaseId || !this.queueName || !this.owner || !this.expiresAt) {
            throw new Error("QueueHeartbeat requires non-empty values");
        }
        Object.freeze(this);
    }
}
export class QueueCheckpoint {
    checkpointId;
    executionId;
    queueName;
    stage;
    createdAt;
    completedStages;
    retryCount;
    metadata;
    constructor(input) {
        this.checkpointId = input.checkpointId.trim();
        this.executionId = input.executionId.trim();
        this.queueName = input.queueName.trim();
        this.stage = input.stage.trim();
        this.createdAt = input.createdAt ?? new Date().toISOString();
        this.completedStages = Object.freeze([...(input.completedStages ?? [])]);
        this.retryCount = input.retryCount ?? 0;
        this.metadata = freezeMetadata((input.metadata ?? {}));
        if (!this.checkpointId || !this.executionId || !this.queueName || !this.stage) {
            throw new Error("QueueCheckpoint requires non-empty values");
        }
        if (!Number.isInteger(this.retryCount) || this.retryCount < 0) {
            throw new Error("QueueCheckpoint.retryCount must be a non-negative integer");
        }
        Object.freeze(this);
    }
}
export class QueueEnvelope {
    messageId;
    type;
    body;
    headers;
    attributes;
    timestamp;
    lease;
    retryContext;
    tracing;
    metadata;
    deliveryAttempt;
    scheduledAt;
    constructor(input) {
        this.messageId = input.messageId.trim();
        this.type = input.type.trim();
        this.body = input.body;
        this.headers = Object.freeze({ ...(input.headers ?? {}) });
        this.attributes = Object.freeze({ ...(input.attributes ?? {}) });
        this.timestamp = input.timestamp ?? new Date().toISOString();
        this.lease = input.lease ?? null;
        this.retryContext = input.retryContext ?? null;
        this.tracing = Object.freeze({ ...input.tracing });
        this.metadata = freezeMetadata((input.metadata ?? {}));
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
export class QueueExecutionContext {
    executionId;
    releaseId;
    jobId;
    queueName;
    adapter;
    stage;
    payload;
    metadata;
    lease;
    checkpoint;
    heartbeat;
    authentication;
    retryCount;
    createdAt;
    updatedAt;
    tracing;
    constructor(input) {
        this.executionId = input.executionId.trim();
        this.releaseId = input.releaseId.trim();
        this.jobId = input.jobId.trim();
        this.queueName = input.queueName.trim();
        this.adapter = input.adapter;
        this.stage = input.stage.trim();
        this.payload = input.payload;
        this.metadata = freezeMetadata((input.metadata ?? {}));
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
export class QueueExecutionResult {
    success;
    failure;
    completedStage;
    executionTime;
    nextStage;
    checkpoint;
    errors;
    warnings;
    metadata;
    constructor(input) {
        this.success = input.success;
        this.failure = input.failure;
        this.completedStage = input.completedStage ?? null;
        this.executionTime = input.executionTime;
        this.nextStage = input.nextStage ?? null;
        this.checkpoint = input.checkpoint ?? null;
        this.errors = Object.freeze([...(input.errors ?? [])]);
        this.warnings = Object.freeze([...(input.warnings ?? [])]);
        this.metadata = freezeMetadata((input.metadata ?? {}));
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
export class DeadLetterMessage {
    messageId;
    queueName;
    reason;
    body;
    retryContext;
    failedAt;
    metadata;
    constructor(input) {
        this.messageId = input.messageId.trim();
        this.queueName = input.queueName.trim();
        this.reason = input.reason.trim();
        this.body = input.body;
        this.retryContext = input.retryContext ?? null;
        this.failedAt = input.failedAt ?? new Date().toISOString();
        this.metadata = freezeMetadata((input.metadata ?? {}));
        if (!this.messageId || !this.queueName || !this.reason) {
            throw new Error("DeadLetterMessage requires non-empty values");
        }
        Object.freeze(this);
    }
}
export class QueueHealthStatus {
    statusId;
    adapter;
    state;
    healthy;
    checkedAt;
    details;
    metadata;
    constructor(input) {
        this.statusId = input.statusId.trim();
        this.adapter = input.adapter;
        this.state = input.state;
        this.healthy = input.healthy;
        this.checkedAt = input.checkedAt ?? new Date().toISOString();
        this.details = Object.freeze({ ...(input.details ?? {}) });
        this.metadata = freezeMetadata((input.metadata ?? {}));
        if (!this.statusId) {
            throw new Error("QueueHealthStatus.statusId must not be empty");
        }
        Object.freeze(this);
    }
}
export class QueueStatistics {
    queueName;
    adapter;
    enqueued;
    dequeued;
    processed;
    failed;
    retried;
    deadLettered;
    queueDepth;
    averageLatencyMs;
    workerUtilization;
    sampledAt;
    metadata;
    constructor(input) {
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
        this.metadata = freezeMetadata((input.metadata ?? {}));
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
export class QueueConfiguration {
    configurationId;
    adapter;
    queueName;
    namespace;
    region;
    enabled;
    retryPolicy;
    leaseDurationMs;
    heartbeatIntervalMs;
    pollIntervalMs;
    concurrency;
    metadata;
    constructor(input) {
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
        this.metadata = freezeMetadata((input.metadata ?? {}));
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
