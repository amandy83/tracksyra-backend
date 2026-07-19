import type { WorkerContext } from "../context/workerContext";
import type { WorkerPipeline } from "../pipeline/workerPipeline";
import type { WorkerExecution } from "../execution/workerExecution";
import type { WorkerResult } from "./workerResult";

export interface WorkerExecutor {
  execute(execution: WorkerExecution, pipeline: WorkerPipeline, context: WorkerContext): Promise<WorkerResult>;
}
