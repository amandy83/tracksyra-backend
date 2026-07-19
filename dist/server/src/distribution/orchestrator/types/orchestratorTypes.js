export class OrchestratorContext {
    release;
    distributionJob;
    package;
    provider;
    executionContext;
    authentication;
    orchestrationId;
    stage;
    lifecycle;
    retryCount;
    checkpointId;
    createdAt;
    updatedAt;
    metadata;
    constructor(input) {
        this.release = input.release;
        this.distributionJob = input.distributionJob ?? null;
        this.package = input.package ?? null;
        this.provider = input.provider ?? null;
        this.executionContext = input.executionContext ?? null;
        this.authentication = input.authentication ?? null;
        this.orchestrationId = input.orchestrationId.trim();
        this.stage = input.stage;
        this.lifecycle = input.lifecycle;
        this.retryCount = input.retryCount ?? 0;
        this.checkpointId = input.checkpointId ?? null;
        this.createdAt = input.createdAt ?? new Date().toISOString();
        this.updatedAt = input.updatedAt ?? this.createdAt;
        this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
        if (!this.orchestrationId) {
            throw new Error("OrchestratorContext.orchestrationId must not be empty");
        }
        if (!Number.isInteger(this.retryCount) || this.retryCount < 0) {
            throw new Error("OrchestratorContext.retryCount must be a non-negative integer");
        }
        Object.freeze(this);
    }
    withStage(stage, lifecycle) {
        return new OrchestratorContext({
            release: this.release,
            orchestrationId: this.orchestrationId,
            stage,
            lifecycle,
            distributionJob: this.distributionJob,
            package: this.package,
            provider: this.provider,
            executionContext: this.executionContext,
            retryCount: this.retryCount,
            checkpointId: this.checkpointId,
            createdAt: this.createdAt,
            updatedAt: new Date().toISOString(),
            metadata: this.metadata,
        });
    }
    withRetryCount(retryCount) {
        return new OrchestratorContext({
            release: this.release,
            orchestrationId: this.orchestrationId,
            stage: this.stage,
            lifecycle: this.lifecycle,
            distributionJob: this.distributionJob,
            package: this.package,
            provider: this.provider,
            executionContext: this.executionContext,
            retryCount,
            checkpointId: this.checkpointId,
            createdAt: this.createdAt,
            updatedAt: new Date().toISOString(),
            metadata: this.metadata,
        });
    }
}
export class OrchestrationResult {
    success;
    failure;
    completedStage;
    executionTime;
    nextStage;
    checkpointId;
    errors;
    warnings;
    metadata;
    constructor(input) {
        this.success = input.success;
        this.failure = input.failure;
        this.completedStage = input.completedStage ?? null;
        this.executionTime = input.executionTime;
        this.nextStage = input.nextStage ?? null;
        this.checkpointId = input.checkpointId ?? null;
        this.errors = Object.freeze([...(input.errors ?? [])]);
        this.warnings = Object.freeze([...(input.warnings ?? [])]);
        this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
        if (!this.success && !this.failure) {
            throw new Error("OrchestrationResult must be success or failure");
        }
        if (this.success && this.failure) {
            throw new Error("OrchestrationResult cannot be both success and failure");
        }
        if (!Number.isFinite(this.executionTime) || this.executionTime < 0) {
            throw new Error("OrchestrationResult.executionTime must be non-negative");
        }
        Object.freeze(this);
    }
}
export class OrchestrationCheckpoint {
    checkpointId;
    orchestrationId;
    releaseId;
    stage;
    createdAt;
    retryCount;
    executionStage;
    metadata;
    constructor(input) {
        this.checkpointId = input.checkpointId.trim();
        this.orchestrationId = input.orchestrationId.trim();
        this.releaseId = input.releaseId.trim();
        this.stage = input.stage;
        this.createdAt = input.createdAt ?? new Date().toISOString();
        this.retryCount = input.retryCount ?? 0;
        this.executionStage = input.executionStage ?? null;
        this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
        if (!this.checkpointId || !this.orchestrationId || !this.releaseId) {
            throw new Error("OrchestrationCheckpoint requires identifiers");
        }
        Object.freeze(this);
    }
}
export class OrchestrationRecovery {
    recoveryId;
    orchestrationId;
    releaseId;
    recovered;
    reason;
    checkpointId;
    recoveredAt;
    metadata;
    constructor(input) {
        this.recoveryId = input.recoveryId.trim();
        this.orchestrationId = input.orchestrationId.trim();
        this.releaseId = input.releaseId.trim();
        this.recovered = input.recovered;
        this.reason = input.reason ?? null;
        this.checkpointId = input.checkpointId ?? null;
        this.recoveredAt = input.recoveredAt ?? new Date().toISOString();
        this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
        if (!this.recoveryId || !this.orchestrationId || !this.releaseId) {
            throw new Error("OrchestrationRecovery requires identifiers");
        }
        Object.freeze(this);
    }
}
