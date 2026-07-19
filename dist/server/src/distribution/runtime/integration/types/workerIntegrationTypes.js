function freezeMetadata(value) {
    return Object.freeze({ ...value });
}
export class WorkerLease {
    leaseId;
    workerId;
    executionId;
    resource;
    owner;
    acquiredAt;
    expiresAt;
    renewCount;
    metadata;
    constructor(input) {
        this.leaseId = input.leaseId.trim();
        this.workerId = input.workerId.trim();
        this.executionId = input.executionId.trim();
        this.resource = input.resource.trim();
        this.owner = input.owner.trim();
        this.acquiredAt = input.acquiredAt ?? new Date().toISOString();
        this.expiresAt = input.expiresAt;
        this.renewCount = input.renewCount ?? 0;
        this.metadata = freezeMetadata((input.metadata ?? {}));
        if (!this.leaseId || !this.workerId || !this.executionId || !this.resource || !this.owner || !this.expiresAt) {
            throw new Error("WorkerLease requires non-empty values");
        }
        if (!Number.isInteger(this.renewCount) || this.renewCount < 0) {
            throw new Error("WorkerLease.renewCount must be a non-negative integer");
        }
        Object.freeze(this);
    }
}
export class WorkerHeartbeat {
    heartbeatId;
    workerId;
    executionId;
    queueName;
    occurredAt;
    expiresAt;
    latencyMs;
    metadata;
    constructor(input) {
        this.heartbeatId = input.heartbeatId.trim();
        this.workerId = input.workerId.trim();
        this.executionId = input.executionId.trim();
        this.queueName = input.queueName.trim();
        this.occurredAt = input.occurredAt ?? new Date().toISOString();
        this.expiresAt = input.expiresAt;
        this.latencyMs = input.latencyMs ?? 0;
        this.metadata = freezeMetadata((input.metadata ?? {}));
        if (!this.heartbeatId || !this.workerId || !this.executionId || !this.queueName || !this.expiresAt) {
            throw new Error("WorkerHeartbeat requires non-empty identifiers");
        }
        if (!Number.isFinite(this.latencyMs) || this.latencyMs < 0) {
            throw new Error("WorkerHeartbeat.latencyMs must be non-negative");
        }
        Object.freeze(this);
    }
}
export class WorkerCheckpoint {
    checkpointId;
    workerId;
    executionId;
    stage;
    queueCheckpoint;
    createdAt;
    completedStages;
    retryCount;
    metadata;
    constructor(input) {
        this.checkpointId = input.checkpointId.trim();
        this.workerId = input.workerId.trim();
        this.executionId = input.executionId.trim();
        this.stage = input.stage.trim();
        this.queueCheckpoint = input.queueCheckpoint ?? null;
        this.createdAt = input.createdAt ?? new Date().toISOString();
        this.completedStages = Object.freeze([...(input.completedStages ?? [])]);
        this.retryCount = input.retryCount ?? 0;
        this.metadata = freezeMetadata((input.metadata ?? {}));
        if (!this.checkpointId || !this.workerId || !this.executionId || !this.stage) {
            throw new Error("WorkerCheckpoint requires non-empty values");
        }
        if (!Number.isInteger(this.retryCount) || this.retryCount < 0) {
            throw new Error("WorkerCheckpoint.retryCount must be a non-negative integer");
        }
        Object.freeze(this);
    }
}
export class WorkerRecovery {
    recoveryId;
    workerId;
    executionId;
    checkpoint;
    resumed;
    reason;
    recoveredAt;
    metadata;
    constructor(input) {
        this.recoveryId = input.recoveryId.trim();
        this.workerId = input.workerId.trim();
        this.executionId = input.executionId.trim();
        this.checkpoint = input.checkpoint ?? null;
        this.resumed = input.resumed ?? false;
        this.reason = input.reason ?? null;
        this.recoveredAt = input.recoveredAt ?? new Date().toISOString();
        this.metadata = freezeMetadata((input.metadata ?? {}));
        if (!this.recoveryId || !this.workerId || !this.executionId) {
            throw new Error("WorkerRecovery requires non-empty identifiers");
        }
        Object.freeze(this);
    }
}
export class WorkerStatistics {
    workerId;
    executionId;
    executionDurationMs;
    retryCount;
    checkpointCount;
    recoveryCount;
    failureCount;
    heartbeatLatencyMs;
    workerUtilization;
    sampledAt;
    metadata;
    constructor(input) {
        this.workerId = input.workerId.trim();
        this.executionId = input.executionId.trim();
        this.executionDurationMs = input.executionDurationMs ?? 0;
        this.retryCount = input.retryCount ?? 0;
        this.checkpointCount = input.checkpointCount ?? 0;
        this.recoveryCount = input.recoveryCount ?? 0;
        this.failureCount = input.failureCount ?? 0;
        this.heartbeatLatencyMs = input.heartbeatLatencyMs ?? 0;
        this.workerUtilization = input.workerUtilization ?? 0;
        this.sampledAt = input.sampledAt ?? new Date().toISOString();
        this.metadata = freezeMetadata((input.metadata ?? {}));
        const values = [
            this.executionDurationMs,
            this.retryCount,
            this.checkpointCount,
            this.recoveryCount,
            this.failureCount,
            this.heartbeatLatencyMs,
            this.workerUtilization,
        ];
        if (!this.workerId || !this.executionId) {
            throw new Error("WorkerStatistics requires non-empty identifiers");
        }
        if (values.some((value) => !Number.isFinite(value) || value < 0)) {
            throw new Error("WorkerStatistics numeric values must be non-negative");
        }
        Object.freeze(this);
    }
}
export class WorkerHealthStatus {
    statusId;
    workerId;
    state;
    healthy;
    checkedAt;
    details;
    queueHealth;
    metadata;
    constructor(input) {
        this.statusId = input.statusId.trim();
        this.workerId = input.workerId.trim();
        this.state = input.state;
        this.healthy = input.healthy;
        this.checkedAt = input.checkedAt ?? new Date().toISOString();
        this.details = Object.freeze({ ...(input.details ?? {}) });
        this.queueHealth = input.queueHealth ?? null;
        this.metadata = freezeMetadata((input.metadata ?? {}));
        if (!this.statusId || !this.workerId) {
            throw new Error("WorkerHealthStatus requires non-empty identifiers");
        }
        Object.freeze(this);
    }
}
export class WorkerConfiguration {
    configurationId;
    workerId;
    queueName;
    enabled;
    concurrency;
    heartbeatIntervalMs;
    checkpointIntervalMs;
    leaseDurationMs;
    restartOnFailure;
    metadata;
    constructor(input) {
        this.configurationId = input.configurationId.trim();
        this.workerId = input.workerId.trim();
        this.queueName = input.queueName.trim();
        this.enabled = input.enabled ?? true;
        this.concurrency = input.concurrency ?? 1;
        this.heartbeatIntervalMs = input.heartbeatIntervalMs ?? 0;
        this.checkpointIntervalMs = input.checkpointIntervalMs ?? 0;
        this.leaseDurationMs = input.leaseDurationMs ?? 0;
        this.restartOnFailure = input.restartOnFailure ?? true;
        this.metadata = freezeMetadata((input.metadata ?? {}));
        const values = [this.concurrency, this.heartbeatIntervalMs, this.checkpointIntervalMs, this.leaseDurationMs];
        if (!this.configurationId || !this.workerId || !this.queueName) {
            throw new Error("WorkerConfiguration requires non-empty identifiers");
        }
        if (values.some((value) => !Number.isFinite(value) || value < 0)) {
            throw new Error("WorkerConfiguration numeric values must be non-negative");
        }
        Object.freeze(this);
    }
}
export class WorkerPipelineExecution {
    pipelineExecutionId;
    workerId;
    executionId;
    pipelineName;
    currentStage;
    completedStages;
    pendingStages;
    startedAt;
    updatedAt;
    finishedAt;
    metadata;
    constructor(input) {
        this.pipelineExecutionId = input.pipelineExecutionId.trim();
        this.workerId = input.workerId.trim();
        this.executionId = input.executionId.trim();
        this.pipelineName = input.pipelineName.trim();
        this.currentStage = input.currentStage ?? null;
        this.completedStages = Object.freeze([...(input.completedStages ?? [])]);
        this.pendingStages = Object.freeze([...(input.pendingStages ?? [])]);
        this.startedAt = input.startedAt ?? new Date().toISOString();
        this.updatedAt = input.updatedAt ?? this.startedAt;
        this.finishedAt = input.finishedAt ?? null;
        this.metadata = freezeMetadata((input.metadata ?? {}));
        if (!this.pipelineExecutionId || !this.workerId || !this.executionId || !this.pipelineName) {
            throw new Error("WorkerPipelineExecution requires non-empty identifiers");
        }
        Object.freeze(this);
    }
}
export class WorkerExecutionContext {
    workerId;
    orchestrationId;
    executionId;
    releaseId;
    jobId;
    queueName;
    pipelineName;
    stage;
    state;
    retryCount;
    lease;
    heartbeat;
    checkpoint;
    recovery;
    queueEnvelope;
    pipelineExecution;
    startedAt;
    updatedAt;
    completedAt;
    cancellationRequested;
    cancellationReason;
    metadata;
    constructor(input) {
        this.workerId = input.workerId.trim();
        this.orchestrationId = input.orchestrationId.trim();
        this.executionId = input.executionId.trim();
        this.releaseId = input.releaseId.trim();
        this.jobId = input.jobId.trim();
        this.queueName = input.queueName.trim();
        this.pipelineName = input.pipelineName.trim();
        this.stage = input.stage.trim();
        this.state = input.state;
        this.retryCount = input.retryCount ?? 0;
        this.lease = input.lease ?? null;
        this.heartbeat = input.heartbeat ?? null;
        this.checkpoint = input.checkpoint ?? null;
        this.recovery = input.recovery ?? null;
        this.queueEnvelope = input.queueEnvelope ?? null;
        this.pipelineExecution = input.pipelineExecution ?? null;
        this.startedAt = input.startedAt ?? new Date().toISOString();
        this.updatedAt = input.updatedAt ?? this.startedAt;
        this.completedAt = input.completedAt ?? null;
        this.cancellationRequested = input.cancellationRequested ?? false;
        this.cancellationReason = input.cancellationReason ?? null;
        this.metadata = freezeMetadata((input.metadata ?? {}));
        if (!this.workerId ||
            !this.orchestrationId ||
            !this.executionId ||
            !this.releaseId ||
            !this.jobId ||
            !this.queueName ||
            !this.pipelineName ||
            !this.stage) {
            throw new Error("WorkerExecutionContext requires non-empty identifiers");
        }
        if (!Number.isInteger(this.retryCount) || this.retryCount < 0) {
            throw new Error("WorkerExecutionContext.retryCount must be a non-negative integer");
        }
        Object.freeze(this);
    }
}
export class WorkerExecutionRequest {
    requestId;
    executionContext;
    queueEnvelope;
    pipelineExecution;
    requestedAt;
    metadata;
    constructor(input) {
        this.requestId = input.requestId.trim();
        this.executionContext = input.executionContext;
        this.queueEnvelope = input.queueEnvelope ?? null;
        this.pipelineExecution = input.pipelineExecution ?? null;
        this.requestedAt = input.requestedAt ?? new Date().toISOString();
        this.metadata = freezeMetadata((input.metadata ?? {}));
        if (!this.requestId) {
            throw new Error("WorkerExecutionRequest.requestId must not be empty");
        }
        Object.freeze(this);
    }
}
export class WorkerExecutionResult {
    success;
    failure;
    executionId;
    workerId;
    completedStage;
    executionTime;
    nextStage;
    checkpoint;
    errors;
    warnings;
    statistics;
    metadata;
    constructor(input) {
        this.success = input.success;
        this.failure = input.failure;
        this.executionId = input.executionId.trim();
        this.workerId = input.workerId.trim();
        this.completedStage = input.completedStage ?? null;
        this.executionTime = input.executionTime;
        this.nextStage = input.nextStage ?? null;
        this.checkpoint = input.checkpoint ?? null;
        this.errors = Object.freeze([...(input.errors ?? [])]);
        this.warnings = Object.freeze([...(input.warnings ?? [])]);
        this.statistics = input.statistics ?? null;
        this.metadata = freezeMetadata((input.metadata ?? {}));
        if (!this.success && !this.failure) {
            throw new Error("WorkerExecutionResult must be success or failure");
        }
        if (this.success && this.failure) {
            throw new Error("WorkerExecutionResult cannot be both success and failure");
        }
        if (!this.executionId || !this.workerId) {
            throw new Error("WorkerExecutionResult requires non-empty identifiers");
        }
        if (!Number.isFinite(this.executionTime) || this.executionTime < 0) {
            throw new Error("WorkerExecutionResult.executionTime must be non-negative");
        }
        Object.freeze(this);
    }
}
