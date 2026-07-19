export class ConflictResolution {
    releaseId;
    conflictType;
    strategy;
    resolved;
    resolvedAt;
    reason;
    metadata;
    constructor(input) {
        this.releaseId = input.releaseId.trim();
        this.conflictType = input.conflictType;
        this.strategy = input.strategy;
        this.resolved = input.resolved;
        this.resolvedAt = input.resolvedAt ?? null;
        this.reason = input.reason ?? null;
        this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
        if (!this.releaseId) {
            throw new Error("ConflictResolution.releaseId must not be empty");
        }
        Object.freeze(this);
    }
}
