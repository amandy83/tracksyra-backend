export class WorkflowPolicySet {
    policySetId;
    retryableStages;
    checkpointableStages;
    compensableStages;
    createdAt;
    metadata;
    constructor(input) {
        this.policySetId = input.policySetId.trim();
        this.retryableStages = Object.freeze([...(input.retryableStages ?? [])]);
        this.checkpointableStages = Object.freeze([...(input.checkpointableStages ?? [])]);
        this.compensableStages = Object.freeze([...(input.compensableStages ?? [])]);
        this.createdAt = input.createdAt ?? new Date().toISOString();
        this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
        if (!this.policySetId) {
            throw new Error("WorkflowPolicySet.policySetId must not be empty");
        }
        Object.freeze(this);
    }
}
