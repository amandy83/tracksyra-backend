export class WorkflowRoyaltyFlow {
    royaltyId;
    steps;
    createdAt;
    metadata;
    constructor(input) {
        this.royaltyId = input.royaltyId.trim();
        this.steps = Object.freeze([...(input.steps ?? [])]);
        this.createdAt = input.createdAt ?? new Date().toISOString();
        this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
        if (!this.royaltyId) {
            throw new Error("WorkflowRoyaltyFlow.royaltyId must not be empty");
        }
        Object.freeze(this);
    }
}
