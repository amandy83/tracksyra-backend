import type { QueueLeasePolicyName } from "../types/queueTypes";

export class QueueLease {
  readonly leaseId: string;
  readonly resource: string;
  readonly owner: string;
  readonly acquiredAt: string;
  readonly expiresAt: string;

  constructor(input: {
    leaseId: string;
    resource: string;
    owner: string;
    acquiredAt?: string;
    expiresAt: string;
  }) {
    this.leaseId = input.leaseId.trim();
    this.resource = input.resource.trim();
    this.owner = input.owner.trim();
    this.acquiredAt = input.acquiredAt ?? new Date().toISOString();
    this.expiresAt = input.expiresAt;
    if (!this.leaseId || !this.resource || !this.owner || !this.expiresAt) {
      throw new Error("QueueLease requires non-empty values");
    }
    Object.freeze(this);
  }

  isExpired(referenceTime: string = new Date().toISOString()): boolean {
    return this.expiresAt <= referenceTime;
  }
}

export interface LeasePolicy {
  readonly policy: QueueLeasePolicyName;
  acquire(resource: string, owner: string): QueueLease | null;
  renew(lease: QueueLease): QueueLease | null;
  release(lease: QueueLease): boolean;
  expire(lease: QueueLease): boolean;
}

