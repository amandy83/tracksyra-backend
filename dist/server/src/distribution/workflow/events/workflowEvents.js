export class WorkflowEvent {
    type;
    workflowId;
    releaseId;
    stage;
    occurredAt;
    payload;
    constructor(input) {
        this.type = input.type;
        this.workflowId = input.workflowId.trim();
        this.releaseId = input.releaseId.trim();
        this.stage = input.stage ?? null;
        this.occurredAt = input.occurredAt ?? new Date().toISOString();
        this.payload = Object.freeze({ ...(input.payload ?? {}) });
        if (!this.workflowId || !this.releaseId) {
            throw new Error("WorkflowEvent requires non-empty identifiers");
        }
        Object.freeze(this);
    }
}
