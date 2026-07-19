import type { WorkerHeartbeat, WorkerLease } from "../types/workerIntegrationTypes";

export interface HeartbeatService {
  start(lease: WorkerLease): Promise<WorkerHeartbeat> | WorkerHeartbeat;
  renew(heartbeat: WorkerHeartbeat): Promise<WorkerHeartbeat> | WorkerHeartbeat;
  stop(heartbeat: WorkerHeartbeat): Promise<boolean> | boolean;
  isExpired(heartbeat: WorkerHeartbeat): boolean;
}
