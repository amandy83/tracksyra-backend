import type { WorkerContext } from "../context/workerContext";
import type { WorkerResult } from "../executor/workerResult";
import type { Worker } from "../registry/workerRegistry";

export interface WorkerRunner {
  run(worker: Worker, context: WorkerContext): Promise<WorkerResult>;
}

