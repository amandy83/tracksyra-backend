export class HealthCheck {
    checkId;
    componentId;
    category;
    status;
    checkedAt;
    latencyMs;
    metadata;
    constructor(input) {
        this.checkId = input.checkId.trim();
        this.componentId = input.componentId.trim();
        this.category = input.category;
        this.status = input.status;
        this.checkedAt = input.checkedAt ?? new Date().toISOString();
        this.latencyMs = input.latencyMs ?? null;
        this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
        if (!this.checkId || !this.componentId) {
            throw new Error("HealthCheck requires checkId and componentId");
        }
        Object.freeze(this);
    }
}
