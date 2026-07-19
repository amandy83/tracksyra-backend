export class RetentionPolicy {
    policyId;
    scope;
    retentionDays;
    archiveAfterDays;
    deleteAfterDays;
    enabled;
    metadata;
    constructor(input) {
        this.policyId = input.policyId.trim();
        this.scope = input.scope.trim();
        this.retentionDays = input.retentionDays;
        this.archiveAfterDays = input.archiveAfterDays ?? null;
        this.deleteAfterDays = input.deleteAfterDays ?? null;
        this.enabled = input.enabled ?? true;
        this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
        if (!this.policyId || !this.scope) {
            throw new Error("RetentionPolicy requires policyId and scope");
        }
        if (!Number.isInteger(this.retentionDays) || this.retentionDays < 0) {
            throw new Error("RetentionPolicy.retentionDays must be a non-negative integer");
        }
        Object.freeze(this);
    }
}
