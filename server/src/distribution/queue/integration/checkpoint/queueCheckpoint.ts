import type { QueueCheckpoint } from "../types/queueIntegrationTypes";

export interface CheckpointManager {
  create(executionId: string, queueName: string, stage: string): Promise<QueueCheckpoint> | QueueCheckpoint;
  restore(checkpointId: string): Promise<QueueCheckpoint | null> | QueueCheckpoint | null;
  validate(checkpoint: QueueCheckpoint): boolean;
  cleanup(executionId: string): Promise<number> | number;
}
