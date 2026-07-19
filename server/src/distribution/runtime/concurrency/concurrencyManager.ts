export interface ConcurrencyManager {
  canStart(workerId: string, executionId: string, releaseId: string): boolean;
  acquireOwnership(workerId: string, executionId: string, releaseId: string): boolean;
  validateLease(workerId: string, executionId: string, releaseId: string): boolean;
  detectConflict(workerId: string, executionId: string, releaseId: string): boolean;
}

