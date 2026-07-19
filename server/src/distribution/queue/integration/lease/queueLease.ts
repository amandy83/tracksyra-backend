import type { QueueLease } from "../types/queueIntegrationTypes";

export interface LeaseManager {
  acquire(resource: string, owner: string): Promise<QueueLease | null> | QueueLease | null;
  renew(lease: QueueLease): Promise<QueueLease | null> | QueueLease | null;
  release(lease: QueueLease): Promise<boolean> | boolean;
  expire(lease: QueueLease): Promise<boolean> | boolean;
}
