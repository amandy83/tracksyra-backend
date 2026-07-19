function freezeMetadata(value) {
    return Object.freeze({ ...value });
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
]);
export class WorkflowContext {
    workflowId;
    releaseId;
    orchestrationId;
    executionId;
    providerName;
    queueName;
    runtimeName;
    authentication;
    stage;
    lifecycle;
    retryCount;
    checkpointId;
    snapshotId;
    createdAt;
    updatedAt;
    metadata;
    constructor(input) {
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
        this.metadata = freezeMetadata((input.metadata ?? {}));
        if (!this.workflowId || !this.releaseId) {
            throw new Error("WorkflowContext requires workflowId and releaseId");
        }
        if (!Number.isInteger(this.retryCount) || this.retryCount < 0) {
            throw new Error("WorkflowContext.retryCount must be a non-negative integer");
        }
        Object.freeze(this);
    }
}
export class WorkflowStage {
    stageId;
    name;
    dependencies;
    retryable;
    checkpointable;
    compensable;
    createdAt;
    metadata;
    constructor(input) {
        this.stageId = input.stageId.trim();
        this.name = input.name;
        this.dependencies = Object.freeze([...(input.dependencies ?? [])]);
        this.retryable = input.retryable ?? true;
        this.checkpointable = input.checkpointable ?? true;
        this.compensable = input.compensable ?? true;
        this.createdAt = input.createdAt ?? new Date().toISOString();
        this.metadata = freezeMetadata((input.metadata ?? {}));
        if (!this.stageId) {
            throw new Error("WorkflowStage.stageId must not be empty");
        }
        Object.freeze(this);
    }
}
export class WorkflowTransition {
    transitionId;
    from;
    to;
    stage;
    validated;
    applied;
    transitionedAt;
    metadata;
    constructor(input) {
        this.transitionId = input.transitionId.trim();
        this.from = input.from;
        this.to = input.to;
        this.stage = input.stage;
        this.validated = input.validated ?? false;
        this.applied = input.applied ?? false;
        this.transitionedAt = input.transitionedAt ?? new Date().toISOString();
        this.metadata = freezeMetadata((input.metadata ?? {}));
        if (!this.transitionId) {
            throw new Error("WorkflowTransition.transitionId must not be empty");
        }
        Object.freeze(this);
    }
}
export class WorkflowCheckpoint {
    checkpointId;
    workflowId;
    releaseId;
    stage;
    retryCount;
    createdAt;
    metadata;
    constructor(input) {
        this.checkpointId = input.checkpointId.trim();
        this.workflowId = input.workflowId.trim();
        this.releaseId = input.releaseId.trim();
        this.stage = input.stage;
        this.retryCount = input.retryCount ?? 0;
        this.createdAt = input.createdAt ?? new Date().toISOString();
        this.metadata = freezeMetadata((input.metadata ?? {}));
        if (!this.checkpointId || !this.workflowId || !this.releaseId) {
            throw new Error("WorkflowCheckpoint requires non-empty identifiers");
        }
        Object.freeze(this);
    }
}
export class WorkflowRecovery {
    recoveryId;
    workflowId;
    releaseId;
    checkpointId;
    recovered;
    reason;
    recoveredAt;
    metadata;
    constructor(input) {
        this.recoveryId = input.recoveryId.trim();
        this.workflowId = input.workflowId.trim();
        this.releaseId = input.releaseId.trim();
        this.checkpointId = input.checkpointId?.trim() || null;
        this.recovered = input.recovered ?? false;
        this.reason = input.reason ?? null;
        this.recoveredAt = input.recoveredAt ?? new Date().toISOString();
        this.metadata = freezeMetadata((input.metadata ?? {}));
        if (!this.recoveryId || !this.workflowId || !this.releaseId) {
            throw new Error("WorkflowRecovery requires non-empty identifiers");
        }
        Object.freeze(this);
    }
}
export class WorkflowCompensation {
    compensationId;
    workflowId;
    releaseId;
    stage;
    reason;
    completed;
    completedAt;
    metadata;
    constructor(input) {
        this.compensationId = input.compensationId.trim();
        this.workflowId = input.workflowId.trim();
        this.releaseId = input.releaseId.trim();
        this.stage = input.stage;
        this.reason = input.reason.trim();
        this.completed = input.completed ?? false;
        this.completedAt = input.completedAt ?? null;
        this.metadata = freezeMetadata((input.metadata ?? {}));
        if (!this.compensationId || !this.workflowId || !this.releaseId || !this.reason) {
            throw new Error("WorkflowCompensation requires non-empty values");
        }
        Object.freeze(this);
    }
}
export class WorkflowProjection {
    projectionId;
    workflowId;
    releaseId;
    projectionType;
    projectedAt;
    metadata;
    constructor(input) {
        this.projectionId = input.projectionId.trim();
        this.workflowId = input.workflowId.trim();
        this.releaseId = input.releaseId.trim();
        this.projectionType = input.projectionType.trim();
        this.projectedAt = input.projectedAt ?? new Date().toISOString();
        this.metadata = freezeMetadata((input.metadata ?? {}));
        if (!this.projectionId || !this.workflowId || !this.releaseId || !this.projectionType) {
            throw new Error("WorkflowProjection requires non-empty values");
        }
        Object.freeze(this);
    }
}
export class WorkflowTimeline {
    timelineId;
    workflowId;
    releaseId;
    stages;
    updatedAt;
    metadata;
    constructor(input) {
        this.timelineId = input.timelineId.trim();
        this.workflowId = input.workflowId.trim();
        this.releaseId = input.releaseId.trim();
        this.stages = Object.freeze([...(input.stages ?? [])]);
        this.updatedAt = input.updatedAt ?? new Date().toISOString();
        this.metadata = freezeMetadata((input.metadata ?? {}));
        if (!this.timelineId || !this.workflowId || !this.releaseId) {
            throw new Error("WorkflowTimeline requires non-empty identifiers");
        }
        Object.freeze(this);
    }
}
export class WorkflowNotification {
    notificationId;
    workflowId;
    releaseId;
    channel;
    status;
    sentAt;
    metadata;
    constructor(input) {
        this.notificationId = input.notificationId.trim();
        this.workflowId = input.workflowId.trim();
        this.releaseId = input.releaseId.trim();
        this.channel = input.channel.trim();
        this.status = input.status.trim();
        this.sentAt = input.sentAt ?? new Date().toISOString();
        this.metadata = freezeMetadata((input.metadata ?? {}));
        if (!this.notificationId || !this.workflowId || !this.releaseId || !this.channel || !this.status) {
            throw new Error("WorkflowNotification requires non-empty values");
        }
        Object.freeze(this);
    }
}
export class WorkflowArchive {
    archiveId;
    workflowId;
    releaseId;
    archivedAt;
    location;
    metadata;
    constructor(input) {
        this.archiveId = input.archiveId.trim();
        this.workflowId = input.workflowId.trim();
        this.releaseId = input.releaseId.trim();
        this.archivedAt = input.archivedAt ?? new Date().toISOString();
        this.location = input.location?.trim() || null;
        this.metadata = freezeMetadata((input.metadata ?? {}));
        if (!this.archiveId || !this.workflowId || !this.releaseId) {
            throw new Error("WorkflowArchive requires non-empty identifiers");
        }
        Object.freeze(this);
    }
}
export class WorkflowReport {
    reportId;
    workflowId;
    releaseId;
    success;
    failure;
    startedAt;
    completedAt;
    errors;
    warnings;
    metadata;
    constructor(input) {
        this.reportId = input.reportId.trim();
        this.workflowId = input.workflowId.trim();
        this.releaseId = input.releaseId.trim();
        this.success = input.success;
        this.failure = input.failure;
        this.startedAt = input.startedAt;
        this.completedAt = input.completedAt ?? new Date().toISOString();
        this.errors = Object.freeze([...(input.errors ?? [])]);
        this.warnings = Object.freeze([...(input.warnings ?? [])]);
        this.metadata = freezeMetadata((input.metadata ?? {}));
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
