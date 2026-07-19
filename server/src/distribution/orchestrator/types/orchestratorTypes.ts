import type { DistributionJobAggregate, Package, ProviderReference, ReleaseAggregate } from "../../domain";
import type { DistributionExecutionContext, DistributionExecutionResult, ExecutionStageName } from "../../execution/types";
import type { AuthenticationSnapshot } from "../../partner-credentials";

export type OrchestrationStageName =
  | "SubmitRelease"
  | "SubmissionLock"
  | "Snapshot"
  | "ValidationPipeline"
  | "Approval"
  | "MetadataBuild"
  | "PackageBuild"
  | "PackageVerification"
  | "ProviderResolution"
  | "ExecutionEngine"
  | "Queue"
  | "WorkerRuntime"
  | "DSPConnector"
  | "StatusSync"
  | "ProjectionUpdate"
  | "Notifications"
  | "RoyaltyEngine"
  | "Archive";

export type OrchestrationLifecycleState =
  | "Created"
  | "Submitted"
  | "Locked"
  | "Snapshotted"
  | "Validating"
  | "Approved"
  | "MetadataBuilt"
  | "Packaged"
  | "Verified"
  | "Resolved"
  | "Executing"
  | "Queued"
  | "Running"
  | "Synced"
  | "Projected"
  | "Notified"
  | "RoyaltyProcessed"
  | "Archived"
  | "Failed"
  | "Cancelled"
  | "Recovered";

export type OrchestrationEventType =
  | "OrchestrationStarted"
  | "OrchestrationStageStarted"
  | "OrchestrationStageCompleted"
  | "OrchestrationCheckpointCreated"
  | "OrchestrationRecovered"
  | "OrchestrationCancelled"
  | "OrchestrationCompleted"
  | "OrchestrationFailed";

export type OrchestrationMetadata = Readonly<Record<string, unknown>>;

export class OrchestratorContext {
  readonly release: ReleaseAggregate;
  readonly distributionJob: DistributionJobAggregate | null;
  readonly package: Package | null;
  readonly provider: ProviderReference | null;
  readonly executionContext: DistributionExecutionContext | null;
  readonly authentication: AuthenticationSnapshot | null;
  readonly orchestrationId: string;
  readonly stage: OrchestrationStageName;
  readonly lifecycle: OrchestrationLifecycleState;
  readonly retryCount: number;
  readonly checkpointId: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly metadata: OrchestrationMetadata;

  constructor(input: {
    release: ReleaseAggregate;
    orchestrationId: string;
    stage: OrchestrationStageName;
    lifecycle: OrchestrationLifecycleState;
    distributionJob?: DistributionJobAggregate | null;
    package?: Package | null;
    provider?: ProviderReference | null;
    executionContext?: DistributionExecutionContext | null;
    authentication?: AuthenticationSnapshot | null;
    retryCount?: number;
    checkpointId?: string | null;
    createdAt?: string;
    updatedAt?: string;
    metadata?: OrchestrationMetadata;
  }) {
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

  withStage(stage: OrchestrationStageName, lifecycle: OrchestrationLifecycleState): OrchestratorContext {
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

  withRetryCount(retryCount: number): OrchestratorContext {
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
  readonly success: boolean;
  readonly failure: boolean;
  readonly completedStage: OrchestrationStageName | null;
  readonly executionTime: number;
  readonly nextStage: OrchestrationStageName | null;
  readonly checkpointId: string | null;
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
  readonly metadata: OrchestrationMetadata;

  constructor(input: {
    success: boolean;
    failure: boolean;
    completedStage?: OrchestrationStageName | null;
    executionTime: number;
    nextStage?: OrchestrationStageName | null;
    checkpointId?: string | null;
    errors?: readonly string[];
    warnings?: readonly string[];
    metadata?: OrchestrationMetadata;
  }) {
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
  readonly checkpointId: string;
  readonly orchestrationId: string;
  readonly releaseId: string;
  readonly stage: OrchestrationStageName;
  readonly createdAt: string;
  readonly retryCount: number;
  readonly executionStage: ExecutionStageName | null;
  readonly metadata: OrchestrationMetadata;

  constructor(input: {
    checkpointId: string;
    orchestrationId: string;
    releaseId: string;
    stage: OrchestrationStageName;
    createdAt?: string;
    retryCount?: number;
    executionStage?: ExecutionStageName | null;
    metadata?: OrchestrationMetadata;
  }) {
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
  readonly recoveryId: string;
  readonly orchestrationId: string;
  readonly releaseId: string;
  readonly recovered: boolean;
  readonly reason: string | null;
  readonly checkpointId: string | null;
  readonly recoveredAt: string;
  readonly metadata: OrchestrationMetadata;

  constructor(input: {
    recoveryId: string;
    orchestrationId: string;
    releaseId: string;
    recovered: boolean;
    reason?: string | null;
    checkpointId?: string | null;
    recoveredAt?: string;
    metadata?: OrchestrationMetadata;
  }) {
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
