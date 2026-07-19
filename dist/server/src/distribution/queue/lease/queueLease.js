export class QueueLease {
    leaseId;
    resource;
    owner;
    acquiredAt;
    expiresAt;
    constructor(input) {
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
    isExpired(referenceTime = new Date().toISOString()) {
        return this.expiresAt <= referenceTime;
    }
}
