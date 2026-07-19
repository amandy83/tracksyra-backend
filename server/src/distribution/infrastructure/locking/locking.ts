import { randomUUID } from "node:crypto";
import type { Clock } from "../clock/clock";
import { SystemClock } from "../clock/clock";

export class LockToken {
  readonly value: string;
  constructor(value: string = randomUUID()) {
    this.value = value;
  }
}

export class LockLease {
  readonly token: LockToken;
  readonly resource: string;
  readonly owner: string;
  readonly acquiredAt: string;
  readonly expiresAt: string;

  constructor(input: { token: LockToken; resource: string; owner: string; acquiredAt?: string; expiresAt: string }) {
    this.token = input.token;
    this.resource = input.resource;
    this.owner = input.owner;
    this.acquiredAt = input.acquiredAt ?? new Date().toISOString();
    this.expiresAt = input.expiresAt;
  }
}

export interface DistributedLock {
  acquire(resource: string, owner: string, ttlMs: number): Promise<LockLease | null>;
  release(resource: string, token: LockToken): Promise<boolean>;
  renew(resource: string, token: LockToken, ttlMs: number): Promise<LockLease | null>;
}

export class SubmissionLockManager implements DistributedLock {
  private readonly leases = new Map<string, LockLease>();

  constructor(private readonly clock: Clock = new SystemClock()) {}

  async acquire(resource: string, owner: string, ttlMs: number): Promise<LockLease | null> {
    const current = this.leases.get(resource);
    if (current && new Date(current.expiresAt).getTime() > this.clock.now().getTime()) return null;
    const token = new LockToken();
    const lease = new LockLease({
      token,
      resource,
      owner,
      acquiredAt: this.clock.nowIso(),
      expiresAt: new Date(this.clock.now().getTime() + ttlMs).toISOString(),
    });
    this.leases.set(resource, lease);
    return lease;
  }

  async release(resource: string, token: LockToken): Promise<boolean> {
    const current = this.leases.get(resource);
    if (!current || current.token.value !== token.value) return false;
    this.leases.delete(resource);
    return true;
  }

  async renew(resource: string, token: LockToken, ttlMs: number): Promise<LockLease | null> {
    const current = this.leases.get(resource);
    if (!current || current.token.value !== token.value) return null;
    const next = new LockLease({
      token,
      resource,
      owner: current.owner,
      acquiredAt: current.acquiredAt,
      expiresAt: new Date(this.clock.now().getTime() + ttlMs).toISOString(),
    });
    this.leases.set(resource, next);
    return next;
  }
}

