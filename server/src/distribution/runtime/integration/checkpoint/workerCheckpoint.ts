import type { WorkerCheckpoint, WorkerExecutionContext } from "../types/workerIntegrationTypes";

export interface CheckpointService {
  create(context: WorkerExecutionContext, stage: string): Promise<WorkerCheckpoint> | WorkerCheckpoint;
  restore(workerId: string, executionId: string, checkpointId: string): Promise<WorkerCheckpoint | null> | WorkerCheckpoint | null;
  validate(checkpoint: WorkerCheckpoint): boolean;
  cleanup(workerId: string, executionId: string): Promise<number> | number;
}
