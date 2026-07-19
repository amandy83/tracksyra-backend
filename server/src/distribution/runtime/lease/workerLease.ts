export class WorkerLease {
  readonly leaseId: string;
  readonly workerId: string;
  readonly executionId: string;
  readonly resource: string;
  readonly owner: string;
  readonly acquiredAt: string;
  readonly expiresAt: string;

  constructor(input: {
    leaseId: string;
    workerId: string;
    executionId: string;
    resource: string;
    owner: string;
    acquiredAt?: string;
    expiresAt: string;
  }) {
    this.leaseId = input.leaseId.trim();
    this.workerId = input.workerId.trim();
    this.executionId = input.executionId.trim();
    this.resource = input.resource.trim();
    this.owner = input.owner.trim();
    this.acquiredAt = input.acquiredAt ?? new Date().toISOString();
    this.expiresAt = input.expiresAt;
    if (!this.leaseId || !this.workerId || !this.executionId || !this.resource || !this.owner || !this.expiresAt) {
      throw new Error("WorkerLease requires non-empty values");
    }
    Object.freeze(this);
  }

  isExpired(referenceTime: string = new Date().toISOString()): boolean {
    return this.expiresAt <= referenceTime;
  }
}

export interface LeaseManager {
  acquire(workerId: string, executionId: string, resource: string, owner: string, ttlMs: number): WorkerLease | null;
  renew(lease: WorkerLease, ttlMs: number): WorkerLease | null;
  release(lease: WorkerLease): boolean;
  expire(lease: WorkerLease): boolean;
}

