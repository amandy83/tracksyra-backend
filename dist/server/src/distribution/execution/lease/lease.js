import { randomUUID } from "node:crypto";
export class LeaseToken {
    value;
    constructor(value = randomUUID()) {
        this.value = value.trim();
        if (!this.value) {
            throw new Error("LeaseToken must not be empty");
        }
        Object.freeze(this);
    }
}
export class ExecutionLease {
    token;
    resource;
    owner;
    acquiredAt;
    expiresAt;
    constructor(input) {
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
    isExpired(referenceTime = new Date().toISOString()) {
        return this.expiresAt <= referenceTime;
    }
}
export class StandardLeaseRenewalPolicy {
    canRenew(lease) {
        return !lease.isExpired();
    }
    renewAt(lease) {
        return lease.expiresAt;
    }
}
export class LeaseManager {
    renewalPolicy;
    leases = new Map();
    constructor(renewalPolicy) {
        this.renewalPolicy = renewalPolicy;
    }
    acquire(resource, owner, ttlMs) {
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
    renew(lease, ttlMs) {
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
    release(lease) {
        const current = this.leases.get(lease.resource);
        if (!current || current.token.value !== lease.token.value) {
            return false;
        }
        this.leases.delete(lease.resource);
        return true;
    }
}
