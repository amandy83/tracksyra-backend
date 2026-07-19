import type { AuthenticationSnapshot } from "../../partner-credentials";

export type WorkflowStageName =
  | "ArtistSubmit"
  | "SubmissionLock"
  | "ReleaseSnapshot"
  | "FreezeMetadata"
  | "FreezeAudio"
  | "FreezeArtwork"
  | "VersionSnapshot"
  | "Validation"
  | "Approval"
  | "UniversalMetadata"
  | "PackageBuild"
  | "PackageVerification"
  | "ManifestValidation"
  | "ChecksumValidation"
  | "FingerprintValidation"
  | "CapabilityResolution"
  | "FeatureFlags"
  | "Priority"
  | "ProviderHealth"
  | "ProviderSelection"
  | "ProviderAuthentication"
  | "ExecutionEngine"
  | "Queue"
  | "Runtime"
  | "DSPConnector"
  | "WebhookPolling"
  | "StatusNormalization"
  | "StateMachine"
  | "ProjectionUpdate"
  | "Dashboard"
  | "Notifications"
  | "CatalogActive"
  | "RoyaltyReports"
  | "RoyaltyImport"
  | "RevenueCalculation"
  | "PaymentProcessing"
  | "StatementGeneration"
  | "ReleaseArchive";

export type WorkflowLifecycleState =
  | "Created"
  | "Submitted"
  | "Locked"
  | "Snapshotted"
  | "Frozen"
  | "Validating"
  | "Approved"
  | "MetadataBuilt"
  | "Packaged"
  | "Verified"
  | "Resolved"
  | "Authenticated"
  | "Executing"
  | "Queued"
  | "Running"
  | "Synced"
  | "Projected"
  | "Notified"
  | "CatalogActive"
  | "RoyaltyProcessed"
  | "Archived"
  | "Failed"
  | "Cancelled"
  | "Recovered";

export type WorkflowEventType =
  | "WorkflowStarted"
  | "WorkflowStageStarted"
  | "WorkflowStageCompleted"
  | "WorkflowCheckpointCreated"
  | "WorkflowRecovered"
  | "WorkflowCompensated"
  | "WorkflowProjectionUpdated"
  | "WorkflowNotificationDispatched"
  | "WorkflowArchived"
  | "WorkflowFailed";

export type WorkflowMetadata = Readonly<Record<string, unknown>>;

function freezeMetadata<T extends WorkflowMetadata>(value: T): T {
  return Object.freeze({ ...value }) as T;
}

export const DEFAULT_WORKFLOW_STAGE_ORDER = Object.freeze([
  "ArtistSubmit",
  "SubmissionLock",
  "ReleaseSnapshot",
  "FreezeMetadata",
  "FreezeAudio",
  "FreezeArtwork",
  "VersionSnapshot",
  "Validation",
  "Approval",
  "UniversalMetadata",
  "PackageBuild",
  "PackageVerification",
  "ManifestValidation",
  "ChecksumValidation",
  "FingerprintValidation",
  "CapabilityResolution",
  "FeatureFlags",
  "Priority",
  "ProviderHealth",
  "ProviderSelection",
  "ProviderAuthentication",
  "ExecutionEngine",
  "Queue",
  "Runtime",
  "DSPConnector",
  "WebhookPolling",
  "StatusNormalization",
  "StateMachine",
  "ProjectionUpdate",
  "Dashboard",
  "Notifications",
  "CatalogActive",
  "RoyaltyReports",
  "RoyaltyImport",
  "RevenueCalculation",
  "PaymentProcessing",
  "StatementGeneration",
  "ReleaseArchive",
] as readonly WorkflowStageName[]);

export class WorkflowContext<TMetadata extends WorkflowMetadata = WorkflowMetadata> {
  readonly workflowId: string;
  readonly releaseId: string;
  readonly orchestrationId: string | null;
  readonly executionId: string | null;
  readonly providerName: string | null;
  readonly queueName: string | null;
  readonly runtimeName: string | null;
  readonly authentication: AuthenticationSnapshot | null;
  readonly stage: WorkflowStageName;
  readonly lifecycle: WorkflowLifecycleState;
  readonly retryCount: number;
  readonly checkpointId: string | null;
  readonly snapshotId: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly metadata: TMetadata;

  constructor(input: {
    workflowId: string;
    releaseId: string;
    stage: WorkflowStageName;
    lifecycle: WorkflowLifecycleState;
    orchestrationId?: string | null;
    executionId?: string | null;
    providerName?: string | null;
    queueName?: string | null;
    runtimeName?: string | null;
    authentication?: AuthenticationSnapshot | null;
    retryCount?: number;
    checkpointId?: string | null;
    snapshotId?: string | null;
    createdAt?: string;
    updatedAt?: string;
    metadata?: TMetadata;
  }) {
    this.workflowId = input.workflowId.trim();
    this.releaseId = input.releaseId.trim();
    this.orchestrationId = input.orchestrationId?.trim() || null;
    this.executionId = input.executionId?.trim() || null;
    this.providerName = input.providerName?.trim() || null;
    this.queueName = input.queueName?.trim() || null;
    this.runtimeName = input.runtimeName?.trim() || null;
    this.authentication = input.authentication ?? null;
    this.stage = input.stage;
    this.lifecycle = input.lifecycle;
    this.retryCount = input.retryCount ?? 0;
    this.checkpointId = input.checkpointId?.trim() || null;
    this.snapshotId = input.snapshotId?.trim() || null;
    this.createdAt = input.createdAt ?? new Date().toISOString();
    this.updatedAt = input.updatedAt ?? this.createdAt;
    this.metadata = freezeMetadata((input.metadata ?? {}) as TMetadata);
    if (!this.workflowId || !this.releaseId) {
      throw new Error("WorkflowContext requires workflowId and releaseId");
    }
    if (!Number.isInteger(this.retryCount) || this.retryCount < 0) {
      throw new Error("WorkflowContext.retryCount must be a non-negative integer");
    }
    Object.freeze(this);
  }
}

export class WorkflowStage<TMetadata extends WorkflowMetadata = WorkflowMetadata> {
  readonly stageId: string;
  readonly name: WorkflowStageName;
  readonly dependencies: readonly WorkflowStageName[];
  readonly retryable: boolean;
  readonly checkpointable: boolean;
  readonly compensable: boolean;
  readonly createdAt: string;
  readonly metadata: TMetadata;

  constructor(input: {
    stageId: string;
    name: WorkflowStageName;
    dependencies?: readonly WorkflowStageName[];
    retryable?: boolean;
    checkpointable?: boolean;
    compensable?: boolean;
    createdAt?: string;
    metadata?: TMetadata;
  }) {
    this.stageId = input.stageId.trim();
    this.name = input.name;
    this.dependencies = Object.freeze([...(input.dependencies ?? [])]);
    this.retryable = input.retryable ?? true;
    this.checkpointable = input.checkpointable ?? true;
    this.compensable = input.compensable ?? true;
    this.createdAt = input.createdAt ?? new Date().toISOString();
    this.metadata = freezeMetadata((input.metadata ?? {}) as TMetadata);
    if (!this.stageId) {
      throw new Error("WorkflowStage.stageId must not be empty");
    }
    Object.freeze(this);
  }
}

export class WorkflowTransition<TMetadata extends WorkflowMetadata = WorkflowMetadata> {
  readonly transitionId: string;
  readonly from: WorkflowStageName;
  readonly to: WorkflowStageName;
  readonly stage: WorkflowStageName;
  readonly validated: boolean;
  readonly applied: boolean;
  readonly transitionedAt: string;
  readonly metadata: TMetadata;

  constructor(input: {
    transitionId: string;
    from: WorkflowStageName;
    to: WorkflowStageName;
    stage: WorkflowStageName;
    validated?: boolean;
    applied?: boolean;
    transitionedAt?: string;
    metadata?: TMetadata;
  }) {
    this.transitionId = input.transitionId.trim();
    this.from = input.from;
    this.to = input.to;
    this.stage = input.stage;
    this.validated = input.validated ?? false;
    this.applied = input.applied ?? false;
    this.transitionedAt = input.transitionedAt ?? new Date().toISOString();
    this.metadata = freezeMetadata((input.metadata ?? {}) as TMetadata);
    if (!this.transitionId) {
      throw new Error("WorkflowTransition.transitionId must not be empty");
    }
    Object.freeze(this);
  }
}

export class WorkflowCheckpoint<TMetadata extends WorkflowMetadata = WorkflowMetadata> {
  readonly checkpointId: string;
  readonly workflowId: string;
  readonly releaseId: string;
  readonly stage: WorkflowStageName;
  readonly retryCount: number;
  readonly createdAt: string;
  readonly metadata: TMetadata;

  constructor(input: {
    checkpointId: string;
    workflowId: string;
    releaseId: string;
    stage: WorkflowStageName;
    retryCount?: number;
    createdAt?: string;
    metadata?: TMetadata;
  }) {
    this.checkpointId = input.checkpointId.trim();
    this.workflowId = input.workflowId.trim();
    this.releaseId = input.releaseId.trim();
    this.stage = input.stage;
    this.retryCount = input.retryCount ?? 0;
    this.createdAt = input.createdAt ?? new Date().toISOString();
    this.metadata = freezeMetadata((input.metadata ?? {}) as TMetadata);
    if (!this.checkpointId || !this.workflowId || !this.releaseId) {
      throw new Error("WorkflowCheckpoint requires non-empty identifiers");
    }
    Object.freeze(this);
  }
}

export class WorkflowRecovery<TMetadata extends WorkflowMetadata = WorkflowMetadata> {
  readonly recoveryId: string;
  readonly workflowId: string;
  readonly releaseId: string;
  readonly checkpointId: string | null;
  readonly recovered: boolean;
  readonly reason: string | null;
  readonly recoveredAt: string;
  readonly metadata: TMetadata;

  constructor(input: {
    recoveryId: string;
    workflowId: string;
    releaseId: string;
    checkpointId?: string | null;
    recovered?: boolean;
    reason?: string | null;
    recoveredAt?: string;
    metadata?: TMetadata;
  }) {
    this.recoveryId = input.recoveryId.trim();
    this.workflowId = input.workflowId.trim();
    this.releaseId = input.releaseId.trim();
    this.checkpointId = input.checkpointId?.trim() || null;
    this.recovered = input.recovered ?? false;
    this.reason = input.reason ?? null;
    this.recoveredAt = input.recoveredAt ?? new Date().toISOString();
    this.metadata = freezeMetadata((input.metadata ?? {}) as TMetadata);
    if (!this.recoveryId || !this.workflowId || !this.releaseId) {
      throw new Error("WorkflowRecovery requires non-empty identifiers");
    }
    Object.freeze(this);
  }
}

export class WorkflowCompensation<TMetadata extends WorkflowMetadata = WorkflowMetadata> {
  readonly compensationId: string;
  readonly workflowId: string;
  readonly releaseId: string;
  readonly stage: WorkflowStageName;
  readonly reason: string;
  readonly completed: boolean;
  readonly completedAt: string | null;
  readonly metadata: TMetadata;

  constructor(input: {
    compensationId: string;
    workflowId: string;
    releaseId: string;
    stage: WorkflowStageName;
    reason: string;
    completed?: boolean;
    completedAt?: string | null;
    metadata?: TMetadata;
  }) {
    this.compensationId = input.compensationId.trim();
    this.workflowId = input.workflowId.trim();
    this.releaseId = input.releaseId.trim();
    this.stage = input.stage;
    this.reason = input.reason.trim();
    this.completed = input.completed ?? false;
    this.completedAt = input.completedAt ?? null;
    this.metadata = freezeMetadata((input.metadata ?? {}) as TMetadata);
    if (!this.compensationId || !this.workflowId || !this.releaseId || !this.reason) {
      throw new Error("WorkflowCompensation requires non-empty values");
    }
    Object.freeze(this);
  }
}

export class WorkflowProjection<TMetadata extends WorkflowMetadata = WorkflowMetadata> {
  readonly projectionId: string;
  readonly workflowId: string;
  readonly releaseId: string;
  readonly projectionType: string;
  readonly projectedAt: string;
  readonly metadata: TMetadata;

  constructor(input: {
    projectionId: string;
    workflowId: string;
    releaseId: string;
    projectionType: string;
    projectedAt?: string;
    metadata?: TMetadata;
  }) {
    this.projectionId = input.projectionId.trim();
    this.workflowId = input.workflowId.trim();
    this.releaseId = input.releaseId.trim();
    this.projectionType = input.projectionType.trim();
    this.projectedAt = input.projectedAt ?? new Date().toISOString();
    this.metadata = freezeMetadata((input.metadata ?? {}) as TMetadata);
    if (!this.projectionId || !this.workflowId || !this.releaseId || !this.projectionType) {
      throw new Error("WorkflowProjection requires non-empty values");
    }
    Object.freeze(this);
  }
}

export class WorkflowTimeline<TMetadata extends WorkflowMetadata = WorkflowMetadata> {
  readonly timelineId: string;
  readonly workflowId: string;
  readonly releaseId: string;
  readonly stages: readonly WorkflowStageName[];
  readonly updatedAt: string;
  readonly metadata: TMetadata;

  constructor(input: {
    timelineId: string;
    workflowId: string;
    releaseId: string;
    stages?: readonly WorkflowStageName[];
    updatedAt?: string;
    metadata?: TMetadata;
  }) {
    this.timelineId = input.timelineId.trim();
    this.workflowId = input.workflowId.trim();
    this.releaseId = input.releaseId.trim();
    this.stages = Object.freeze([...(input.stages ?? [])]);
    this.updatedAt = input.updatedAt ?? new Date().toISOString();
    this.metadata = freezeMetadata((input.metadata ?? {}) as TMetadata);
    if (!this.timelineId || !this.workflowId || !this.releaseId) {
      throw new Error("WorkflowTimeline requires non-empty identifiers");
    }
    Object.freeze(this);
  }
}

export class WorkflowNotification<TMetadata extends WorkflowMetadata = WorkflowMetadata> {
  readonly notificationId: string;
  readonly workflowId: string;
  readonly releaseId: string;
  readonly channel: string;
  readonly status: string;
  readonly sentAt: string;
  readonly metadata: TMetadata;

  constructor(input: {
    notificationId: string;
    workflowId: string;
    releaseId: string;
    channel: string;
    status: string;
    sentAt?: string;
    metadata?: TMetadata;
  }) {
    this.notificationId = input.notificationId.trim();
    this.workflowId = input.workflowId.trim();
    this.releaseId = input.releaseId.trim();
    this.channel = input.channel.trim();
    this.status = input.status.trim();
    this.sentAt = input.sentAt ?? new Date().toISOString();
    this.metadata = freezeMetadata((input.metadata ?? {}) as TMetadata);
    if (!this.notificationId || !this.workflowId || !this.releaseId || !this.channel || !this.status) {
      throw new Error("WorkflowNotification requires non-empty values");
    }
    Object.freeze(this);
  }
}

export class WorkflowArchive<TMetadata extends WorkflowMetadata = WorkflowMetadata> {
  readonly archiveId: string;
  readonly workflowId: string;
  readonly releaseId: string;
  readonly archivedAt: string;
  readonly location: string | null;
  readonly metadata: TMetadata;

  constructor(input: {
    archiveId: string;
    workflowId: string;
    releaseId: string;
    archivedAt?: string;
    location?: string | null;
    metadata?: TMetadata;
  }) {
    this.archiveId = input.archiveId.trim();
    this.workflowId = input.workflowId.trim();
    this.releaseId = input.releaseId.trim();
    this.archivedAt = input.archivedAt ?? new Date().toISOString();
    this.location = input.location?.trim() || null;
    this.metadata = freezeMetadata((input.metadata ?? {}) as TMetadata);
    if (!this.archiveId || !this.workflowId || !this.releaseId) {
      throw new Error("WorkflowArchive requires non-empty identifiers");
    }
    Object.freeze(this);
  }
}

export class WorkflowReport<TMetadata extends WorkflowMetadata = WorkflowMetadata> {
  readonly reportId: string;
  readonly workflowId: string;
  readonly releaseId: string;
  readonly success: boolean;
  readonly failure: boolean;
  readonly startedAt: string;
  readonly completedAt: string;
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
  readonly metadata: TMetadata;

  constructor(input: {
    reportId: string;
    workflowId: string;
    releaseId: string;
    success: boolean;
    failure: boolean;
    startedAt: string;
    completedAt?: string;
    errors?: readonly string[];
    warnings?: readonly string[];
    metadata?: TMetadata;
  }) {
    this.reportId = input.reportId.trim();
    this.workflowId = input.workflowId.trim();
    this.releaseId = input.releaseId.trim();
    this.success = input.success;
    this.failure = input.failure;
    this.startedAt = input.startedAt;
    this.completedAt = input.completedAt ?? new Date().toISOString();
    this.errors = Object.freeze([...(input.errors ?? [])]);
    this.warnings = Object.freeze([...(input.warnings ?? [])]);
    this.metadata = freezeMetadata((input.metadata ?? {}) as TMetadata);
    if (!this.reportId || !this.workflowId || !this.releaseId) {
      throw new Error("WorkflowReport requires non-empty identifiers");
    }
    if (!this.success && !this.failure) {
      throw new Error("WorkflowReport must be success or failure");
    }
    if (this.success && this.failure) {
      throw new Error("WorkflowReport cannot be both success and failure");
    }
    Object.freeze(this);
  }
}
