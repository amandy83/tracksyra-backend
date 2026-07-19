import type { WorkerLease } from "../types/workerIntegrationTypes";

export interface LeaseService {
  acquire(resource: string, owner: string, workerId: string, executionId: string): Promise<WorkerLease | null> | WorkerLease | null;
  renew(lease: WorkerLease): Promise<WorkerLease | null> | WorkerLease | null;
  release(lease: WorkerLease): Promise<boolean> | boolean;
  expire(lease: WorkerLease): Promise<boolean> | boolean;
}
