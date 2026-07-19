export class WorkerLease {
    leaseId;
    workerId;
    executionId;
    resource;
    owner;
    acquiredAt;
    expiresAt;
    constructor(input) {
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
    isExpired(referenceTime = new Date().toISOString()) {
        return this.expiresAt <= referenceTime;
    }
}
