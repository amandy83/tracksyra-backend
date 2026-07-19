export class ReconciliationResult {
    releaseId;
    success;
    snapshot;
    normalizedStatus;
    transition;
    conflictResolution;
    warnings;
    errors;
    reconciledAt;
    metadata;
    constructor(input) {
        this.releaseId = input.releaseId.trim();
        this.success = input.success;
        this.snapshot = input.snapshot;
        this.normalizedStatus = input.normalizedStatus;
        this.transition = input.transition ?? null;
        this.conflictResolution = input.conflictResolution ?? null;
        this.warnings = Object.freeze([...(input.warnings ?? [])]);
        this.errors = Object.freeze([...(input.errors ?? [])]);
        this.reconciledAt = input.reconciledAt ?? new Date().toISOString();
        this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
        if (!this.releaseId) {
            throw new Error("ReconciliationResult.releaseId must not be empty");
        }
        Object.freeze(this);
    }
}
