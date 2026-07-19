export class DashboardProjection {
    projectionId;
    scope;
    widgets;
    updatedAt;
    metadata;
    constructor(input) {
        this.projectionId = input.projectionId.trim();
        this.scope = input.scope.trim();
        this.widgets = Object.freeze({ ...(input.widgets ?? {}) });
        this.updatedAt = input.updatedAt ?? new Date().toISOString();
        this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
        if (!this.projectionId || !this.scope) {
            throw new Error("DashboardProjection requires projectionId and scope");
        }
        Object.freeze(this);
    }
}
