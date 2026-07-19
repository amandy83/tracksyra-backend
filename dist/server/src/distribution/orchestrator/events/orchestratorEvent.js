export class OrchestratorEvent {
    type;
    orchestrationId;
    releaseId;
    occurredAt;
    payload;
    constructor(input) {
        this.type = input.type;
        this.orchestrationId = input.orchestrationId.trim();
        this.releaseId = input.releaseId.trim();
        this.occurredAt = input.occurredAt ?? new Date().toISOString();
        this.payload = Object.freeze({ ...(input.payload ?? {}) });
        if (!this.orchestrationId || !this.releaseId) {
            throw new Error("OrchestratorEvent requires identifiers");
        }
        Object.freeze(this);
    }
}
