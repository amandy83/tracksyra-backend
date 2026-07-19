import type { QueueCheckpoint, QueueEnvelope, QueueHealthStatus, QueueLease, QueueStatistics } from "../../../queue/integration/types/queueIntegrationTypes";

export type WorkerRuntimeState =
  | "Created"
  | "Reserved"
  | "Started"
  | "Running"
  | "Checkpointing"
  | "Completed"
  | "Failed"
  | "Cancelled"
  | "Recovered";

export type WorkerFailureCategory = "Retryable" | "Recoverable" | "Manual Intervention" | "Fatal";

export type WorkerEventType =
  | "WorkerCreated"
  | "WorkerReserved"
  | "WorkerStarted"
  | "WorkerRunning"
  | "WorkerCheckpointCreated"
  | "WorkerRecovered"
  | "WorkerCancelled"
  | "WorkerCompleted"
  | "WorkerFailed"
  | "HeartbeatExpired"
  | "LeaseExpired";

export type WorkerMetadata = Readonly<Record<string, unknown>>;

function freezeMetadata<T extends WorkerMetadata>(value: T): T {
  return Object.freeze({ ...value }) as T;
}

export class WorkerLease<TMetadata extends WorkerMetadata = WorkerMetadata> {
  readonly leaseId: string;
  readonly workerId: string;
  readonly executionId: string;
  readonly resource: string;
  readonly owner: string;
  readonly acquiredAt: string;
  readonly expiresAt: string;
  readonly renewCount: number;
  readonly metadata: TMetadata;

  constructor(input: {
    leaseId: string;
    workerId: string;
    executionId: string;
    resource: string;
    owner: string;
    acquiredAt?: string;
    expiresAt: string;
    renewCount?: number;
    metadata?: TMetadata;
  }) {
    this.leaseId = input.leaseId.trim();
    this.workerId = input.workerId.trim();
    this.executionId = input.executionId.trim();
    this.resource = input.resource.trim();
    this.owner = input.owner.trim();
    this.acquiredAt = input.acquiredAt ?? new Date().toISOString();
    this.expiresAt = input.expiresAt;
    this.renewCount = input.renewCount ?? 0;
    this.metadata = freezeMetadata((input.metadata ?? {}) as TMetadata);
    if (!this.leaseId || !this.workerId || !this.executionId || !this.resource || !this.owner || !this.expiresAt) {
      throw new Error("WorkerLease requires non-empty values");
    }
    if (!Number.isInteger(this.renewCount) || this.renewCount < 0) {
      throw new Error("WorkerLease.renewCount must be a non-negative integer");
    }
    Object.freeze(this);
  }
}

export class WorkerHeartbeat<TMetadata extends WorkerMetadata = WorkerMetadata> {
  readonly heartbeatId: string;
  readonly workerId: string;
  readonly executionId: string;
  readonly queueName: string;
  readonly occurredAt: string;
  readonly expiresAt: string;
  readonly latencyMs: number;
  readonly metadata: TMetadata;

  constructor(input: {
    heartbeatId: string;
    workerId: string;
    executionId: string;
    queueName: string;
    occurredAt?: string;
    expiresAt: string;
    latencyMs?: number;
    metadata?: TMetadata;
  }) {
    this.heartbeatId = input.heartbeatId.trim();
    this.workerId = input.workerId.trim();
    this.executionId = input.executionId.trim();
    this.queueName = input.queueName.trim();
    this.occurredAt = input.occurredAt ?? new Date().toISOString();
    this.expiresAt = input.expiresAt;
    this.latencyMs = input.latencyMs ?? 0;
    this.metadata = freezeMetadata((input.metadata ?? {}) as TMetadata);
    if (!this.heartbeatId || !this.workerId || !this.executionId || !this.queueName || !this.expiresAt) {
      throw new Error("WorkerHeartbeat requires non-empty identifiers");
    }
    if (!Number.isFinite(this.latencyMs) || this.latencyMs < 0) {
      throw new Error("WorkerHeartbeat.latencyMs must be non-negative");
    }
    Object.freeze(this);
  }
}

export class WorkerCheckpoint<TMetadata extends WorkerMetadata = WorkerMetadata> {
  readonly checkpointId: string;
  readonly workerId: string;
  readonly executionId: string;
  readonly stage: string;
  readonly queueCheckpoint: QueueCheckpoint | null;
  readonly createdAt: string;
  readonly completedStages: readonly string[];
  readonly retryCount: number;
  readonly metadata: TMetadata;

  constructor(input: {
    checkpointId: string;
    workerId: string;
    executionId: string;
    stage: string;
    queueCheckpoint?: QueueCheckpoint | null;
    createdAt?: string;
    completedStages?: readonly string[];
    retryCount?: number;
    metadata?: TMetadata;
  }) {
    this.checkpointId = input.checkpointId.trim();
    this.workerId = input.workerId.trim();
    this.executionId = input.executionId.trim();
    this.stage = input.stage.trim();
    this.queueCheckpoint = input.queueCheckpoint ?? null;
    this.createdAt = input.createdAt ?? new Date().toISOString();
    this.completedStages = Object.freeze([...(input.completedStages ?? [])]);
    this.retryCount = input.retryCount ?? 0;
    this.metadata = freezeMetadata((input.metadata ?? {}) as TMetadata);
    if (!this.checkpointId || !this.workerId || !this.executionId || !this.stage) {
      throw new Error("WorkerCheckpoint requires non-empty values");
    }
    if (!Number.isInteger(this.retryCount) || this.retryCount < 0) {
      throw new Error("WorkerCheckpoint.retryCount must be a non-negative integer");
    }
    Object.freeze(this);
  }
}

export class WorkerRecovery<TMetadata extends WorkerMetadata = WorkerMetadata> {
  readonly recoveryId: string;
  readonly workerId: string;
  readonly executionId: string;
  readonly checkpoint: WorkerCheckpoint | null;
  readonly resumed: boolean;
  readonly reason: string | null;
  readonly recoveredAt: string;
  readonly metadata: TMetadata;

  constructor(input: {
    recoveryId: string;
    workerId: string;
    executionId: string;
    checkpoint?: WorkerCheckpoint | null;
    resumed?: boolean;
    reason?: string | null;
    recoveredAt?: string;
    metadata?: TMetadata;
  }) {
    this.recoveryId = input.recoveryId.trim();
    this.workerId = input.workerId.trim();
    this.executionId = input.executionId.trim();
    this.checkpoint = input.checkpoint ?? null;
    this.resumed = input.resumed ?? false;
    this.reason = input.reason ?? null;
    this.recoveredAt = input.recoveredAt ?? new Date().toISOString();
    this.metadata = freezeMetadata((input.metadata ?? {}) as TMetadata);
    if (!this.recoveryId || !this.workerId || !this.executionId) {
      throw new Error("WorkerRecovery requires non-empty identifiers");
    }
    Object.freeze(this);
  }
}

export class WorkerStatistics<TMetadata extends WorkerMetadata = WorkerMetadata> {
  readonly workerId: string;
  readonly executionId: string;
  readonly executionDurationMs: number;
  readonly retryCount: number;
  readonly checkpointCount: number;
  readonly recoveryCount: number;
  readonly failureCount: number;
  readonly heartbeatLatencyMs: number;
  readonly workerUtilization: number;
  readonly sampledAt: string;
  readonly metadata: TMetadata;

  constructor(input: {
    workerId: string;
    executionId: string;
    executionDurationMs?: number;
    retryCount?: number;
    checkpointCount?: number;
    recoveryCount?: number;
    failureCount?: number;
    heartbeatLatencyMs?: number;
    workerUtilization?: number;
    sampledAt?: string;
    metadata?: TMetadata;
  }) {
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
    this.metadata = freezeMetadata((input.metadata ?? {}) as TMetadata);
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

export class WorkerHealthStatus<TMetadata extends WorkerMetadata = WorkerMetadata> {
  readonly statusId: string;
  readonly workerId: string;
  readonly state: "Healthy" | "Degraded" | "Unhealthy" | "Unknown";
  readonly healthy: boolean;
  readonly checkedAt: string;
  readonly details: Readonly<Record<string, unknown>>;
  readonly queueHealth: QueueHealthStatus | null;
  readonly metadata: TMetadata;

  constructor(input: {
    statusId: string;
    workerId: string;
    state: "Healthy" | "Degraded" | "Unhealthy" | "Unknown";
    healthy: boolean;
    checkedAt?: string;
    details?: Readonly<Record<string, unknown>>;
    queueHealth?: QueueHealthStatus | null;
    metadata?: TMetadata;
  }) {
    this.statusId = input.statusId.trim();
    this.workerId = input.workerId.trim();
    this.state = input.state;
    this.healthy = input.healthy;
    this.checkedAt = input.checkedAt ?? new Date().toISOString();
    this.details = Object.freeze({ ...(input.details ?? {}) });
    this.queueHealth = input.queueHealth ?? null;
    this.metadata = freezeMetadata((input.metadata ?? {}) as TMetadata);
    if (!this.statusId || !this.workerId) {
      throw new Error("WorkerHealthStatus requires non-empty identifiers");
    }
    Object.freeze(this);
  }
}

export class WorkerConfiguration<TMetadata extends WorkerMetadata = WorkerMetadata> {
  readonly configurationId: string;
  readonly workerId: string;
  readonly queueName: string;
  readonly enabled: boolean;
  readonly concurrency: number;
  readonly heartbeatIntervalMs: number;
  readonly checkpointIntervalMs: number;
  readonly leaseDurationMs: number;
  readonly restartOnFailure: boolean;
  readonly metadata: TMetadata;

  constructor(input: {
    configurationId: string;
    workerId: string;
    queueName: string;
    enabled?: boolean;
    concurrency?: number;
    heartbeatIntervalMs?: number;
    checkpointIntervalMs?: number;
    leaseDurationMs?: number;
    restartOnFailure?: boolean;
    metadata?: TMetadata;
  }) {
    this.configurationId = input.configurationId.trim();
    this.workerId = input.workerId.trim();
    this.queueName = input.queueName.trim();
    this.enabled = input.enabled ?? true;
    this.concurrency = input.concurrency ?? 1;
    this.heartbeatIntervalMs = input.heartbeatIntervalMs ?? 0;
    this.checkpointIntervalMs = input.checkpointIntervalMs ?? 0;
    this.leaseDurationMs = input.leaseDurationMs ?? 0;
    this.restartOnFailure = input.restartOnFailure ?? true;
    this.metadata = freezeMetadata((input.metadata ?? {}) as TMetadata);
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

export class WorkerPipelineExecution<TMetadata extends WorkerMetadata = WorkerMetadata> {
  readonly pipelineExecutionId: string;
  readonly workerId: string;
  readonly executionId: string;
  readonly pipelineName: string;
  readonly currentStage: string | null;
  readonly completedStages: readonly string[];
  readonly pendingStages: readonly string[];
  readonly startedAt: string;
  readonly updatedAt: string;
  readonly finishedAt: string | null;
  readonly metadata: TMetadata;

  constructor(input: {
    pipelineExecutionId: string;
    workerId: string;
    executionId: string;
    pipelineName: string;
    currentStage?: string | null;
    completedStages?: readonly string[];
    pendingStages?: readonly string[];
    startedAt?: string;
    updatedAt?: string;
    finishedAt?: string | null;
    metadata?: TMetadata;
  }) {
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
    this.metadata = freezeMetadata((input.metadata ?? {}) as TMetadata);
    if (!this.pipelineExecutionId || !this.workerId || !this.executionId || !this.pipelineName) {
      throw new Error("WorkerPipelineExecution requires non-empty identifiers");
    }
    Object.freeze(this);
  }
}

export class WorkerExecutionContext<TMetadata extends WorkerMetadata = WorkerMetadata> {
  readonly workerId: string;
  readonly orchestrationId: string;
  readonly executionId: string;
  readonly releaseId: string;
  readonly jobId: string;
  readonly queueName: string;
  readonly pipelineName: string;
  readonly stage: string;
  readonly state: WorkerRuntimeState;
  readonly retryCount: number;
  readonly lease: WorkerLease<TMetadata> | null;
  readonly heartbeat: WorkerHeartbeat<TMetadata> | null;
  readonly checkpoint: WorkerCheckpoint<TMetadata> | null;
  readonly recovery: WorkerRecovery<TMetadata> | null;
  readonly queueEnvelope: QueueEnvelope | null;
  readonly pipelineExecution: WorkerPipelineExecution<TMetadata> | null;
  readonly startedAt: string;
  readonly updatedAt: string;
  readonly completedAt: string | null;
  readonly cancellationRequested: boolean;
  readonly cancellationReason: string | null;
  readonly metadata: TMetadata;

  constructor(input: {
    workerId: string;
    orchestrationId: string;
    executionId: string;
    releaseId: string;
    jobId: string;
    queueName: string;
    pipelineName: string;
    stage: string;
    state: WorkerRuntimeState;
    retryCount?: number;
    lease?: WorkerLease<TMetadata> | null;
    heartbeat?: WorkerHeartbeat<TMetadata> | null;
    checkpoint?: WorkerCheckpoint<TMetadata> | null;
    recovery?: WorkerRecovery<TMetadata> | null;
    queueEnvelope?: QueueEnvelope | null;
    pipelineExecution?: WorkerPipelineExecution<TMetadata> | null;
    startedAt?: string;
    updatedAt?: string;
    completedAt?: string | null;
    cancellationRequested?: boolean;
    cancellationReason?: string | null;
    metadata?: TMetadata;
  }) {
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
    this.metadata = freezeMetadata((input.metadata ?? {}) as TMetadata);
    if (
      !this.workerId ||
      !this.orchestrationId ||
      !this.executionId ||
      !this.releaseId ||
      !this.jobId ||
      !this.queueName ||
      !this.pipelineName ||
      !this.stage
    ) {
      throw new Error("WorkerExecutionContext requires non-empty identifiers");
    }
    if (!Number.isInteger(this.retryCount) || this.retryCount < 0) {
      throw new Error("WorkerExecutionContext.retryCount must be a non-negative integer");
    }
    Object.freeze(this);
  }
}

export class WorkerExecutionRequest<TMetadata extends WorkerMetadata = WorkerMetadata> {
  readonly requestId: string;
  readonly executionContext: WorkerExecutionContext<TMetadata>;
  readonly queueEnvelope: QueueEnvelope | null;
  readonly pipelineExecution: WorkerPipelineExecution<TMetadata> | null;
  readonly requestedAt: string;
  readonly metadata: TMetadata;

  constructor(input: {
    requestId: string;
    executionContext: WorkerExecutionContext<TMetadata>;
    queueEnvelope?: QueueEnvelope | null;
    pipelineExecution?: WorkerPipelineExecution<TMetadata> | null;
    requestedAt?: string;
    metadata?: TMetadata;
  }) {
    this.requestId = input.requestId.trim();
    this.executionContext = input.executionContext;
    this.queueEnvelope = input.queueEnvelope ?? null;
    this.pipelineExecution = input.pipelineExecution ?? null;
    this.requestedAt = input.requestedAt ?? new Date().toISOString();
    this.metadata = freezeMetadata((input.metadata ?? {}) as TMetadata);
    if (!this.requestId) {
      throw new Error("WorkerExecutionRequest.requestId must not be empty");
    }
    Object.freeze(this);
  }
}

export class WorkerExecutionResult<TMetadata extends WorkerMetadata = WorkerMetadata> {
  readonly success: boolean;
  readonly failure: boolean;
  readonly executionId: string;
  readonly workerId: string;
  readonly completedStage: string | null;
  readonly executionTime: number;
  readonly nextStage: string | null;
  readonly checkpoint: WorkerCheckpoint<TMetadata> | null;
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
  readonly statistics: WorkerStatistics<TMetadata> | null;
  readonly metadata: TMetadata;

  constructor(input: {
    success: boolean;
    failure: boolean;
    executionId: string;
    workerId: string;
    completedStage?: string | null;
    executionTime: number;
    nextStage?: string | null;
    checkpoint?: WorkerCheckpoint<TMetadata> | null;
    errors?: readonly string[];
    warnings?: readonly string[];
    statistics?: WorkerStatistics<TMetadata> | null;
    metadata?: TMetadata;
  }) {
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
    this.metadata = freezeMetadata((input.metadata ?? {}) as TMetadata);
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
