export class WorkerCheckpoint {
  readonly checkpointId: string;
  readonly workerId: string;
  readonly executionId: string;
  readonly stage: string;
  readonly createdAt: string;
  readonly restoredAt: string | null;
  readonly checksum: string | null;
  readonly data: Readonly<Record<string, unknown>>;

  constructor(input: {
    checkpointId: string;
    workerId: string;
    executionId: string;
    stage: string;
    createdAt?: string;
    restoredAt?: string | null;
    checksum?: string | null;
    data?: Readonly<Record<string, unknown>>;
  }) {
    this.checkpointId = input.checkpointId.trim();
    this.workerId = input.workerId.trim();
    this.executionId = input.executionId.trim();
    this.stage = input.stage.trim();
    this.createdAt = input.createdAt ?? new Date().toISOString();
    this.restoredAt = input.restoredAt ?? null;
    this.checksum = input.checksum ?? null;
    this.data = Object.freeze({ ...(input.data ?? {}) });
    if (!this.checkpointId || !this.workerId || !this.executionId || !this.stage) {
      throw new Error("WorkerCheckpoint requires non-empty identifiers");
    }
    Object.freeze(this);
  }
}

export interface CheckpointManager {
  create(workerId: string, executionId: string, stage: string, data: Readonly<Record<string, unknown>>): Promise<WorkerCheckpoint>;
  restore(workerId: string, executionId: string, checkpointId: string): Promise<WorkerCheckpoint | null>;
  validate(checkpoint: WorkerCheckpoint): boolean;
  cleanup(workerId: string, executionId: string): Promise<number>;
}

export interface CheckpointRepository {
  save(checkpoint: WorkerCheckpoint): Promise<void> | void;
  load(workerId: string, executionId: string, checkpointId: string): Promise<WorkerCheckpoint | null> | WorkerCheckpoint | null;
  list(workerId: string, executionId: string): Promise<readonly WorkerCheckpoint[]> | readonly WorkerCheckpoint[];
  delete(workerId: string, executionId: string, checkpointId: string): Promise<void> | void;
}

