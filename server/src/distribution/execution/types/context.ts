import type { DistributionJobAggregate, Package, ProviderReference, ReleaseAggregate } from "../../domain";
import type { Checkpoint } from "../checkpoint/checkpoint";
import type { AuthenticationSnapshot } from "../../partner-credentials";
import type { ExecutionCancellationToken, ExecutionStageName, ExecutionTimestamps } from "./types";

function freezeRecord(value: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> {
  return Object.freeze({ ...value });
}

function freezeStages(value: readonly ExecutionStageName[]): readonly ExecutionStageName[] {
  return Object.freeze([...new Set(value)]);
}

export class DistributionExecutionContext {
  readonly release: ReleaseAggregate;
  readonly distributionJob: DistributionJobAggregate;
  readonly package: Package | null;
  readonly metadata: Readonly<Record<string, unknown>>;
  readonly provider: ProviderReference | null;
  readonly executionId: string;
  readonly checkpoint: Checkpoint | null;
  readonly stage: ExecutionStageName;
  readonly timestamps: ExecutionTimestamps;
  readonly retryCount: number;
  readonly cancellationToken: ExecutionCancellationToken;
  readonly executionMetadata: Readonly<Record<string, unknown>>;
  readonly authentication: AuthenticationSnapshot | null;

  constructor(input: {
    release: ReleaseAggregate;
    distributionJob: DistributionJobAggregate;
    package?: Package | null;
    metadata?: Readonly<Record<string, unknown>>;
    provider?: ProviderReference | null;
    executionId: string;
    checkpoint?: Checkpoint | null;
    stage: ExecutionStageName;
    timestamps?: Partial<ExecutionTimestamps>;
    retryCount?: number;
    cancellationToken?: ExecutionCancellationToken;
    executionMetadata?: Readonly<Record<string, unknown>>;
    authentication?: AuthenticationSnapshot | null;
  }) {
    this.release = input.release;
    this.distributionJob = input.distributionJob;
    this.package = input.package ?? null;
    this.metadata = freezeRecord(input.metadata ?? {});
    this.provider = input.provider ?? null;
    this.executionId = input.executionId.trim();
    if (!this.executionId) {
      throw new Error("executionId must not be empty");
    }
    this.checkpoint = input.checkpoint ?? null;
    this.stage = input.stage;
    const startedAt = input.timestamps?.startedAt ?? new Date().toISOString();
    const updatedAt = input.timestamps?.updatedAt ?? startedAt;
    this.timestamps = Object.freeze({
      startedAt,
      updatedAt,
      completedAt: input.timestamps?.completedAt ?? null,
    });
    this.retryCount = input.retryCount ?? 0;
    if (!Number.isInteger(this.retryCount) || this.retryCount < 0) {
      throw new Error("retryCount must be a non-negative integer");
    }
    this.cancellationToken = input.cancellationToken ?? {
      cancelled: false,
      reason: null,
      throwIfCancelled(): void {
        return;
      },
    };
    this.executionMetadata = freezeRecord(input.executionMetadata ?? {});
    this.authentication = input.authentication ?? null;
    Object.freeze(this);
  }

  withStage(stage: ExecutionStageName): DistributionExecutionContext {
    return new DistributionExecutionContext({
      release: this.release,
      distributionJob: this.distributionJob,
      package: this.package,
      metadata: this.metadata,
      provider: this.provider,
      executionId: this.executionId,
      checkpoint: this.checkpoint,
      stage,
      timestamps: {
        ...this.timestamps,
        updatedAt: new Date().toISOString(),
      },
      retryCount: this.retryCount,
      cancellationToken: this.cancellationToken,
      executionMetadata: this.executionMetadata,
      authentication: this.authentication,
    });
  }

  withCheckpoint(checkpoint: Checkpoint | null): DistributionExecutionContext {
    return new DistributionExecutionContext({
      release: this.release,
      distributionJob: this.distributionJob,
      package: this.package,
      metadata: this.metadata,
      provider: this.provider,
      executionId: this.executionId,
      checkpoint,
      stage: this.stage,
      timestamps: {
        ...this.timestamps,
        updatedAt: new Date().toISOString(),
      },
      retryCount: this.retryCount,
      cancellationToken: this.cancellationToken,
      executionMetadata: this.executionMetadata,
      authentication: this.authentication,
    });
  }

  withPackage(packageModel: Package | null): DistributionExecutionContext {
    return new DistributionExecutionContext({
      release: this.release,
      distributionJob: this.distributionJob,
      package: packageModel,
      metadata: this.metadata,
      provider: this.provider,
      executionId: this.executionId,
      checkpoint: this.checkpoint,
      stage: this.stage,
      timestamps: this.timestamps,
      retryCount: this.retryCount,
      cancellationToken: this.cancellationToken,
      executionMetadata: this.executionMetadata,
      authentication: this.authentication,
    });
  }

  withProvider(provider: ProviderReference | null): DistributionExecutionContext {
    return new DistributionExecutionContext({
      release: this.release,
      distributionJob: this.distributionJob,
      package: this.package,
      metadata: this.metadata,
      provider,
      executionId: this.executionId,
      checkpoint: this.checkpoint,
      stage: this.stage,
      timestamps: this.timestamps,
      retryCount: this.retryCount,
      cancellationToken: this.cancellationToken,
      executionMetadata: this.executionMetadata,
      authentication: this.authentication,
    });
  }

  withRetryCount(retryCount: number): DistributionExecutionContext {
    return new DistributionExecutionContext({
      release: this.release,
      distributionJob: this.distributionJob,
      package: this.package,
      metadata: this.metadata,
      provider: this.provider,
      executionId: this.executionId,
      checkpoint: this.checkpoint,
      stage: this.stage,
      timestamps: this.timestamps,
      retryCount,
      cancellationToken: this.cancellationToken,
      executionMetadata: this.executionMetadata,
      authentication: this.authentication,
    });
  }

  withExecutionMetadata(executionMetadata: Readonly<Record<string, unknown>>): DistributionExecutionContext {
    return new DistributionExecutionContext({
      release: this.release,
      distributionJob: this.distributionJob,
      package: this.package,
      metadata: this.metadata,
      provider: this.provider,
      executionId: this.executionId,
      checkpoint: this.checkpoint,
      stage: this.stage,
      timestamps: this.timestamps,
      retryCount: this.retryCount,
      cancellationToken: this.cancellationToken,
      executionMetadata,
      authentication: this.authentication,
    });
  }

  withCompletedStage(stage: ExecutionStageName): DistributionExecutionContext {
    const completedStages = freezeStages([
      ...this.completedStages(),
      stage,
    ]);
    return this.withExecutionMetadata({
      ...this.executionMetadata,
      completedStages,
    });
  }

  completedStages(): readonly ExecutionStageName[] {
    const stages = this.executionMetadata.completedStages;
    return Array.isArray(stages) ? freezeStages(stages as readonly ExecutionStageName[]) : [];
  }
}
