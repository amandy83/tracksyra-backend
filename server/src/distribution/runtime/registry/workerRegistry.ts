import type { WorkerContext } from "../context/workerContext";
import type { WorkerResult } from "../executor/workerResult";

export interface Worker {
  readonly name: string;
  execute(context: WorkerContext): Promise<WorkerResult>;
}

export interface WorkerRegistry {
  register(worker: Worker): void;
  resolve(name: string): Worker | null;
  list(): readonly Worker[];
}
