import type { QueueHeartbeat, QueueLease } from "../types/queueIntegrationTypes";

export interface HeartbeatManager {
  start(lease: QueueLease): Promise<QueueHeartbeat> | QueueHeartbeat;
  renew(heartbeat: QueueHeartbeat): Promise<QueueHeartbeat> | QueueHeartbeat;
  stop(heartbeat: QueueHeartbeat): Promise<boolean> | boolean;
  isExpired(heartbeat: QueueHeartbeat): boolean;
}
