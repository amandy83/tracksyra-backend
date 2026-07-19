import { randomUUID } from "node:crypto";
export class DefaultDistributedLeaderElection {
    leaders = new Map();
    elect(resource, candidate, metadata = {}) {
        const current = this.leaders.get(resource);
        const leader = Object.freeze({
            leaderId: candidate,
            term: (current?.term ?? 0) + 1,
            electedAt: new Date().toISOString(),
            expiresAt: null,
            metadata: Object.freeze({ ...metadata }),
        });
        this.leaders.set(resource, leader);
        return leader;
    }
    current(resource) {
        return this.leaders.get(resource) ?? null;
    }
}
export class DefaultLeaseOwnership {
    leases = new Map();
    claim(resource, owner, ttlMs, metadata = {}) {
        const current = this.leases.get(resource);
        if (current && new Date(current.expiresAt).getTime() > Date.now()) {
            return null;
        }
        const next = Object.freeze({
            resource,
            owner,
            leaseId: randomUUID(),
            acquiredAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + ttlMs).toISOString(),
            metadata: Object.freeze({ ...metadata }),
        });
        this.leases.set(resource, next);
        return next;
    }
    renew(resource, leaseId, ttlMs, metadata = {}) {
        const current = this.leases.get(resource);
        if (!current || current.leaseId !== leaseId)
            return null;
        const next = Object.freeze({
            resource,
            owner: current.owner,
            leaseId,
            acquiredAt: current.acquiredAt,
            expiresAt: new Date(Date.now() + ttlMs).toISOString(),
            metadata: Object.freeze({ ...metadata }),
        });
        this.leases.set(resource, next);
        return next;
    }
    release(resource, leaseId) {
        const current = this.leases.get(resource);
        if (!current || current.leaseId !== leaseId)
            return false;
        this.leases.delete(resource);
        return true;
    }
    current(resource) {
        return this.leases.get(resource) ?? null;
    }
}
export class DefaultWorkerOwnership {
    workers = new Map();
    claim(workerId, owner, ttlMs, metadata = {}) {
        const current = this.workers.get(workerId);
        if (current && current.state === "owned" && current.expiresAt && new Date(current.expiresAt).getTime() > Date.now()) {
            return null;
        }
        const next = Object.freeze({
            workerId,
            owner,
            state: "owned",
            leasedAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + ttlMs).toISOString(),
            metadata: Object.freeze({ ...metadata }),
        });
        this.workers.set(workerId, next);
        return next;
    }
    release(workerId, owner) {
        const current = this.workers.get(workerId);
        if (!current || current.owner !== owner)
            return false;
        this.workers.delete(workerId);
        return true;
    }
    current(workerId) {
        return this.workers.get(workerId) ?? null;
    }
}
export class DefaultExecutionFencing {
    fences = new Map();
    issue(resource, owner, metadata = {}) {
        const fence = Object.freeze({
            fenceId: randomUUID(),
            resource,
            owner,
            issuedAt: new Date().toISOString(),
            metadata: Object.freeze({ ...metadata }),
        });
        this.fences.set(resource, fence);
        return fence;
    }
    current(resource) {
        return this.fences.get(resource) ?? null;
    }
}
export class DefaultDuplicateExecutionPrevention {
    fingerprints = new Map();
    has(key) {
        return this.fingerprints.has(key.value);
    }
    store(key, fingerprint) {
        this.fingerprints.set(key.value, fingerprint);
    }
    resolve(key) {
        return this.fingerprints.get(key.value) ?? null;
    }
}
export class DefaultCheckpointOwnership {
    checkpoints = new Map();
    claim(checkpointId, owner, metadata = {}) {
        const current = this.checkpoints.get(checkpointId);
        if (current)
            return null;
        const record = Object.freeze({
            resource: checkpointId,
            owner,
            leaseId: randomUUID(),
            acquiredAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 60_000).toISOString(),
            metadata: Object.freeze({ ...metadata }),
        });
        this.checkpoints.set(checkpointId, record);
        return record;
    }
    current(checkpointId) {
        return this.checkpoints.get(checkpointId) ?? null;
    }
}
export class DefaultRecoveryOwnership {
    recoveries = new Map();
    claim(recoveryId, owner, metadata = {}) {
        const current = this.recoveries.get(recoveryId);
        if (current)
            return null;
        const record = Object.freeze({
            resource: recoveryId,
            owner,
            leaseId: randomUUID(),
            acquiredAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 60_000).toISOString(),
            metadata: Object.freeze({ ...metadata }),
        });
        this.recoveries.set(recoveryId, record);
        return record;
    }
    current(recoveryId) {
        return this.recoveries.get(recoveryId) ?? null;
    }
}
export class DefaultStaleLeaseDetection {
    leases;
    constructor(leases) {
        this.leases = leases;
    }
    isStale(resource) {
        const current = this.leases.current(resource);
        return Boolean(current && new Date(current.expiresAt).getTime() <= Date.now());
    }
}
export class DefaultHeartbeatOwnership {
    heartbeats = new Map();
    beat(resource, owner, metadata = {}) {
        const record = Object.freeze({
            resource,
            owner,
            leaseId: randomUUID(),
            acquiredAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 30_000).toISOString(),
            metadata: Object.freeze({ ...metadata }),
        });
        this.heartbeats.set(resource, record);
        return record;
    }
    current(resource) {
        return this.heartbeats.get(resource) ?? null;
    }
}
export class DefaultExecutionTokenService {
    tokens = new Map();
    issue(resource, owner, ttlMs, metadata = {}) {
        const token = Object.freeze({
            token: randomUUID(),
            resource,
            owner,
            createdAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + ttlMs).toISOString(),
            metadata: Object.freeze({ ...metadata }),
        });
        this.tokens.set(token.token, token);
        return token;
    }
    resolve(token) {
        return this.tokens.get(token) ?? null;
    }
    revoke(token) {
        return this.tokens.delete(token);
    }
}
export function createDefaultDistributedCoordinationBundle(bundle) {
    return bundle;
}
