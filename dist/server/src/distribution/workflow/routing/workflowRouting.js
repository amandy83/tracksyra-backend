export class WorkflowRoute {
    routeId;
    from;
    to;
    createdAt;
    metadata;
    constructor(input) {
        this.routeId = input.routeId.trim();
        this.from = input.from;
        this.to = input.to;
        this.createdAt = input.createdAt ?? new Date().toISOString();
        this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
        if (!this.routeId) {
            throw new Error("WorkflowRoute.routeId must not be empty");
        }
        Object.freeze(this);
    }
}
