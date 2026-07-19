import type { WorkerCheckpoint } from "../checkpoint/workerCheckpoint";
import type { WorkerContext } from "../context/workerContext";

export interface WorkerRecoveryManager {
  resume(context: WorkerContext, checkpoint: WorkerCheckpoint | null): Promise<WorkerContext> | WorkerContext;
  restoreCheckpoint(context: WorkerContext, checkpointId: string): Promise<WorkerCheckpoint | null> | WorkerCheckpoint | null;
  recoverLease(context: WorkerContext): Promise<WorkerContext> | WorkerContext;
  replay(context: WorkerContext): Promise<WorkerContext> | WorkerContext;
  recoverIdempotently(context: WorkerContext): Promise<WorkerContext> | WorkerContext;
}

