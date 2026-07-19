import { randomUUID } from "node:crypto";

export class LeaseToken {
  readonly value: string;

  constructor(value: string = randomUUID()) {
    this.value = value.trim();
    if (!this.value) {
      throw new Error("LeaseToken must not be empty");
    }
    Object.freeze(this);
  }
}

export class ExecutionLease {
  readonly token: LeaseToken;
  readonly resource: string;
  readonly owner: string;
  readonly acquiredAt: string;
  readonly expiresAt: string;

  constructor(input: { token: LeaseToken; resource: string; owner: string; acquiredAt?: string; expiresAt: string }) {
    this.token = input.token;
    this.resource = input.resource.trim();
    this.owner = input.owner.trim();
    this.acquiredAt = input.acquiredAt ?? new Date().toISOString();
    this.expiresAt = input.expiresAt;
    if (!this.resource || !this.owner || !this.expiresAt) {
      throw new Error("ExecutionLease requires resource, owner, and expiresAt");
    }
    Object.freeze(this);
  }

  isExpired(referenceTime: string = new Date().toISOString()): boolean {
    return this.expiresAt <= referenceTime;
  }
}

export interface LeaseRenewalPolicy {
  canRenew(lease: ExecutionLease): boolean;
  renewAt(lease: ExecutionLease): string;
}

export class StandardLeaseRenewalPolicy implements LeaseRenewalPolicy {
  canRenew(lease: ExecutionLease): boolean {
    return !lease.isExpired();
  }

  renewAt(lease: ExecutionLease): string {
    return lease.expiresAt;
  }
}

export class LeaseManager {
  private readonly leases = new Map<string, ExecutionLease>();

  constructor(private readonly renewalPolicy: LeaseRenewalPolicy) {}

  acquire(resource: string, owner: string, ttlMs: number): ExecutionLease | null {
    const current = this.leases.get(resource);
    if (current && !current.isExpired()) {
      return null;
    }
    const lease = new ExecutionLease({
      token: new LeaseToken(),
      resource,
      owner,
      expiresAt: new Date(Date.now() + ttlMs).toISOString(),
    });
    this.leases.set(resource, lease);
    return lease;
  }

  renew(lease: ExecutionLease, ttlMs: number): ExecutionLease | null {
    if (!this.renewalPolicy.canRenew(lease)) {
      return null;
    }
    const renewed = new ExecutionLease({
      token: lease.token,
      resource: lease.resource,
      owner: lease.owner,
      acquiredAt: lease.acquiredAt,
      expiresAt: new Date(Date.now() + ttlMs).toISOString(),
    });
    this.leases.set(lease.resource, renewed);
    return renewed;
  }

  release(lease: ExecutionLease): boolean {
    const current = this.leases.get(lease.resource);
    if (!current || current.token.value !== lease.token.value) {
      return false;
    }
    this.leases.delete(lease.resource);
    return true;
  }
}
