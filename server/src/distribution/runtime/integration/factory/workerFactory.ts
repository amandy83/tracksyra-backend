import type { WorkerRuntime } from "../contracts/workerRuntimeContracts";
import type { WorkerConfiguration } from "../types/workerIntegrationTypes";

export interface WorkerFactory {
  create(configuration: WorkerConfiguration): WorkerRuntime;
}
