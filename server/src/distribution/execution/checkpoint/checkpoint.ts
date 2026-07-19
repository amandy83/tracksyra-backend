import type { ExecutionCheckpoint, ExecutionStageName } from "../types";
import type { DistributionExecutionContext } from "../types/context";

function createCheckpointId(executionId: string, stage: ExecutionStageName): string {
  const safeExecutionId = executionId.replace(/[^A-Za-z0-9._-]/g, "_");
  return `${safeExecutionId}:${stage}:${new Date().toISOString()}`;
}

export class Checkpoint implements ExecutionCheckpoint {
  readonly checkpointId: string;
  readonly executionId: string;
  readonly stage: ExecutionStageName;
  readonly createdAt: string;
  readonly completedStages: readonly ExecutionStageName[];
  readonly retryCount: number;
  readonly data: Readonly<Record<string, unknown>>;

  constructor(input: {
    executionId: string;
    stage: ExecutionStageName;
    createdAt?: string;
    completedStages?: readonly ExecutionStageName[];
    retryCount?: number;
    data?: Readonly<Record<string, unknown>>;
    checkpointId?: string;
  }) {
    this.executionId = input.executionId.trim();
    if (!this.executionId) {
      throw new Error("executionId must not be empty");
    }
    this.stage = input.stage;
    this.createdAt = input.createdAt ?? new Date().toISOString();
    this.completedStages = Object.freeze([...(input.completedStages ?? [])]);
    this.retryCount = input.retryCount ?? 0;
    this.data = Object.freeze({ ...(input.data ?? {}) });
    this.checkpointId = input.checkpointId ?? createCheckpointId(this.executionId, this.stage);
    if (!Number.isInteger(this.retryCount) || this.retryCount < 0) {
      throw new Error("retryCount must be a non-negative integer");
    }
    Object.freeze(this);
  }
}

export interface CheckpointStore {
  save(checkpoint: Checkpoint): Promise<void> | void;
  list(executionId: string): Promise<readonly Checkpoint[]> | readonly Checkpoint[];
  load(executionId: string, checkpointId: string): Promise<Checkpoint | null> | Checkpoint | null;
}

export interface CheckpointStrategy {
  shouldCheckpoint(context: DistributionExecutionContext): boolean;
}

export class StageCheckpointStrategy implements CheckpointStrategy {
  shouldCheckpoint(context: DistributionExecutionContext): boolean {
    return !context.cancellationToken.cancelled;
  }
}

export class CheckpointManager {
  constructor(
    private readonly store: CheckpointStore,
    private readonly strategy: CheckpointStrategy,
  ) {}

  shouldCheckpoint(context: DistributionExecutionContext): boolean {
    return this.strategy.shouldCheckpoint(context);
  }

  async create(context: DistributionExecutionContext): Promise<Checkpoint | null> {
    if (!this.shouldCheckpoint(context)) {
      return null;
    }
    const checkpoint = new Checkpoint({
      executionId: context.executionId,
      stage: context.stage,
      completedStages: context.completedStages(),
      retryCount: context.retryCount,
      data: {
        metadata: context.executionMetadata,
        provider: context.provider?.value ?? null,
        packageFingerprint: context.package?.fingerprint.value ?? null,
        releaseId: context.release.release.id.value,
        distributionJobId: context.distributionJob.id.value,
      },
    });
    await this.store.save(checkpoint);
    return checkpoint;
  }

  async loadLatest(executionId: string): Promise<Checkpoint | null> {
    const items = await Promise.resolve(this.store.list(executionId));
    return items.at(-1) ?? null;
  }
}

export class CheckpointResolver {
  constructor(private readonly store: CheckpointStore) {}

  async resolve(executionId: string, checkpointId?: string | null): Promise<Checkpoint | null> {
    if (checkpointId) {
      return await Promise.resolve(this.store.load(executionId, checkpointId));
    }
    const items = await Promise.resolve(this.store.list(executionId));
    return items.at(-1) ?? null;
  }
}
