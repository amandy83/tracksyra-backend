export class HealthStatus {
    componentId;
    category;
    healthy;
    severity;
    observedAt;
    message;
    metadata;
    constructor(input) {
        this.componentId = input.componentId.trim();
        this.category = input.category;
        this.healthy = input.healthy;
        this.severity = input.severity ?? (input.healthy ? "healthy" : "unhealthy");
        this.observedAt = input.observedAt ?? new Date().toISOString();
        this.message = input.message ?? null;
        this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
        if (!this.componentId) {
            throw new Error("HealthStatus.componentId must not be empty");
        }
        Object.freeze(this);
    }
}
