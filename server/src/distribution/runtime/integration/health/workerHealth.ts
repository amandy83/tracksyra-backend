import type { WorkerConfiguration, WorkerHealthStatus } from "../types/workerIntegrationTypes";

export interface WorkerHealthChecker {
  check(configuration: WorkerConfiguration): Promise<WorkerHealthStatus> | WorkerHealthStatus;
  probe(workerId: string): Promise<WorkerHealthStatus> | WorkerHealthStatus;
}
