import type { DistributionJobAggregate, Package, ProviderReference, ReleaseAggregate } from "../../domain";
import type { DistributionExecutionContext } from "./context";
import type { DistributionExecutionResult } from "./result";

export type ExecutionStageName =
  | "Submission"
  | "SubmissionLock"
  | "Snapshot"
  | "Validation"
  | "Approval"
  | "MetadataGeneration"
  | "PackageBuild"
  | "PackageVerification"
  | "ProviderResolution"
  | "ProviderAuthentication"
  | "PackageUpload"
  | "ProviderProcessing"
  | "StatusNormalization"
  | "StateTransition"
  | "DashboardProjection"
  | "NotificationDispatch"
  | "CatalogActivation"
  | "RoyaltyImport"
  | "RevenueCalculation"
  | "PaymentProcessing"
  | "StatementGeneration"
  | "Archive";

export type ExecutionPipelineName =
  | "SubmissionPipeline"
  | "ValidationPipeline"
  | "ApprovalPipeline"
  | "MetadataPipeline"
  | "PackagingPipeline"
  | "VerificationPipeline"
  | "ProviderSelectionPipeline"
  | "AuthenticationPipeline"
  | "UploadPipeline"
  | "ProviderProcessingPipeline"
  | "StatusPipeline"
  | "DashboardPipeline"
  | "NotificationPipeline"
  | "RoyaltyPipeline"
  | "PaymentPipeline"
  | "ArchivePipeline";

export type ExecutionFailureCategory = "Retryable" | "Recoverable" | "Manual Intervention" | "Fatal";

export interface ExecutionCancellationToken {
  readonly cancelled: boolean;
  readonly reason: string | null;
  throwIfCancelled(): void;
}

export class ImmutableExecutionCancellationToken implements ExecutionCancellationToken {
  readonly cancelled: boolean;
  readonly reason: string | null;

  constructor(input: { cancelled?: boolean; reason?: string | null } = {}) {
    this.cancelled = input.cancelled ?? false;
    this.reason = input.reason ?? null;
    Object.freeze(this);
  }

  throwIfCancelled(): void {
    if (this.cancelled) {
      throw new Error(this.reason ?? "Execution cancelled");
    }
  }
}

export interface ExecutionTimestamps {
  readonly startedAt: string;
  readonly updatedAt: string;
  readonly completedAt: string | null;
}

export interface ExecutionStageDefinition<TContext> {
  readonly name: ExecutionStageName;
  readonly dependencies: readonly ExecutionStageName[];
  execute(context: TContext): Promise<TContext> | TContext;
}

export interface ExecutionPipelineDefinition {
  readonly name: ExecutionPipelineName;
  readonly stages: readonly ExecutionStageName[];
}

export interface ExecutionCheckpointDocument {
  readonly checkpointId: string;
  readonly executionId: string;
  readonly stage: ExecutionStageName;
  readonly createdAt: string;
  readonly completedStages: readonly ExecutionStageName[];
  readonly retryCount: number;
  readonly data: Readonly<Record<string, unknown>>;
}

export interface ExecutionEventBase<EventType extends string = string, Payload extends Record<string, unknown> = Record<string, unknown>> {
  readonly type: EventType;
  readonly executionId: string;
  readonly pipeline: ExecutionPipelineName | null;
  readonly stage: ExecutionStageName | null;
  readonly occurredAt: string;
  readonly payload: Readonly<Payload>;
}

export type ExecutionStarted = ExecutionEventBase<"ExecutionStarted", {
  jobId: string;
  releaseId: string;
}>;

export type StageStarted = ExecutionEventBase<"StageStarted", {
  stage: ExecutionStageName;
}>;

export type StageCompleted = ExecutionEventBase<"StageCompleted", {
  stage: ExecutionStageName;
}>;

export type CheckpointCreated = ExecutionEventBase<"CheckpointCreated", {
  checkpointId: string;
  stage: ExecutionStageName;
}>;

export type ExecutionPaused = ExecutionEventBase<"ExecutionPaused", {
  stage: ExecutionStageName | null;
  reason: string | null;
}>;

export type ExecutionResumed = ExecutionEventBase<"ExecutionResumed", {
  checkpointId: string | null;
}>;

export type ExecutionCancelled = ExecutionEventBase<"ExecutionCancelled", {
  reason: string | null;
}>;

export type ExecutionRecovered = ExecutionEventBase<"ExecutionRecovered", {
  checkpointId: string | null;
  reason: string | null;
}>;

export type ExecutionCompleted = ExecutionEventBase<"ExecutionCompleted", {
  completedStage: ExecutionStageName | null;
  executionTime: number;
}>;

export type ExecutionFailed = ExecutionEventBase<"ExecutionFailed", {
  failedStage: ExecutionStageName | null;
  errors: readonly string[];
}>;

export type DistributionExecutionEvent =
  | ExecutionStarted
  | StageStarted
  | StageCompleted
  | CheckpointCreated
  | ExecutionPaused
  | ExecutionResumed
  | ExecutionCancelled
  | ExecutionRecovered
  | ExecutionCompleted
  | ExecutionFailed;

export interface ExecutionEngine {
  execute(
    job: DistributionJobAggregate,
    context: DistributionExecutionContext,
    pipeline: ExecutionPipeline,
  ): Promise<DistributionExecutionResult>;
}

export interface ExecutionStage {
  readonly name: ExecutionStageName;
  readonly dependencies: readonly ExecutionStageName[];
  execute(context: DistributionExecutionContext): Promise<DistributionExecutionContext> | DistributionExecutionContext;
}

export interface ExecutionPipeline {
  readonly name: ExecutionPipelineName;
  readonly stages: readonly ExecutionStageName[];
}

export interface ExecutionScheduler {
  next(
    context: DistributionExecutionContext,
    pipeline: ExecutionPipeline,
    availableStages: ExecutionStageRegistryLike,
  ): ExecutionStageName | null;
}

export interface ExecutionCheckpoint {
  readonly checkpointId: string;
  readonly executionId: string;
  readonly stage: ExecutionStageName;
  readonly createdAt: string;
  readonly completedStages: readonly ExecutionStageName[];
  readonly retryCount: number;
  readonly data: Readonly<Record<string, unknown>>;
}

export interface ExecutionRecovery {
  recover(
    error: unknown,
    context: DistributionExecutionContext,
    checkpoint: ExecutionCheckpoint | null,
  ): RecoveryDecision;
}

export interface ExecutionDispatcher {
  dispatch(
    job: DistributionJobAggregate,
    context: DistributionExecutionContext,
    pipeline: ExecutionPipeline,
  ): Promise<DistributionExecutionContext>;
}

export interface ExecutionLease {
  readonly token: string;
  readonly resource: string;
  readonly owner: string;
  readonly acquiredAt: string;
  readonly expiresAt: string;
  isExpired(referenceTime?: string): boolean;
}

export interface ExecutionRouter {
  resolvePipeline(job: DistributionJobAggregate, context: DistributionExecutionContext): ExecutionPipeline;
  resolveStage(stage: ExecutionStageName): ExecutionStage | null;
}

export interface ExecutionStageRegistryLike {
  get(stage: ExecutionStageName): ExecutionStage | null;
  has(stage: ExecutionStageName): boolean;
  list(): readonly ExecutionStage[];
}

export interface RecoveryDecision {
  readonly category: ExecutionFailureCategory;
  readonly retry: boolean;
  readonly resume: boolean;
  readonly pause: boolean;
  readonly fatal: boolean;
  readonly message: string;
  readonly checkpointId: string | null;
  readonly retryAfterStage: ExecutionStageName | null;
  readonly manualInterventionRequired: boolean;
}
