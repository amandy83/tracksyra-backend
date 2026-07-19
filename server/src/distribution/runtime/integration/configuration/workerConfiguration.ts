import type { WorkerConfiguration } from "../types/workerIntegrationTypes";

export interface WorkerConfigurationProvider {
  load(workerId: string): Promise<WorkerConfiguration | null> | WorkerConfiguration | null;
  save(configuration: WorkerConfiguration): Promise<void> | void;
  list(): Promise<readonly WorkerConfiguration[]> | readonly WorkerConfiguration[];
}
