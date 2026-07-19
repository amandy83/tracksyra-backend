export class Incident {
    incidentId;
    level;
    title;
    description;
    openedAt;
    resolvedAt;
    status;
    metadata;
    constructor(input) {
        this.incidentId = input.incidentId.trim();
        this.level = input.level;
        this.title = input.title.trim();
        this.description = input.description.trim();
        this.openedAt = input.openedAt ?? new Date().toISOString();
        this.resolvedAt = input.resolvedAt ?? null;
        this.status = input.status ?? "open";
        this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
        if (!this.incidentId || !this.title || !this.description) {
            throw new Error("Incident requires incidentId, title, and description");
        }
        Object.freeze(this);
    }
}
