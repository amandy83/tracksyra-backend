import { randomUUID } from "node:crypto";
import { SystemClock } from "../clock/clock.js";
export class LockToken {
    value;
    constructor(value = randomUUID()) {
        this.value = value;
    }
}
export class LockLease {
    token;
    resource;
    owner;
    acquiredAt;
    expiresAt;
    constructor(input) {
        this.token = input.token;
        this.resource = input.resource;
        this.owner = input.owner;
        this.acquiredAt = input.acquiredAt ?? new Date().toISOString();
        this.expiresAt = input.expiresAt;
    }
}
export class SubmissionLockManager {
    clock;
    leases = new Map();
    constructor(clock = new SystemClock()) {
        this.clock = clock;
    }
    async acquire(resource, owner, ttlMs) {
        const current = this.leases.get(resource);
        if (current && new Date(current.expiresAt).getTime() > this.clock.now().getTime())
            return null;
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
    async release(resource, token) {
        const current = this.leases.get(resource);
        if (!current || current.token.value !== token.value)
            return false;
        this.leases.delete(resource);
        return true;
    }
    async renew(resource, token, ttlMs) {
        const current = this.leases.get(resource);
        if (!current || current.token.value !== token.value)
            return null;
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
