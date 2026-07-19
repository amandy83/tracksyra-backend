import type { WorkerCheckpoint, WorkerExecutionContext, WorkerRecovery } from "../types/workerIntegrationTypes";

export interface RecoveryService {
  recover(context: WorkerExecutionContext, checkpoint: WorkerCheckpoint | null): Promise<WorkerRecovery> | WorkerRecovery;
}
