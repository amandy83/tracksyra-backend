import type { WorkerExecution } from "../execution/workerExecution";
import type { WorkerPipeline } from "../pipeline/workerPipeline";

export interface WorkerScheduler {
  schedule(execution: WorkerExecution, pipeline: WorkerPipeline): Promise<string | null> | string | null;
  next(execution: WorkerExecution, pipeline: WorkerPipeline): Promise<string | null> | string | null;
}

