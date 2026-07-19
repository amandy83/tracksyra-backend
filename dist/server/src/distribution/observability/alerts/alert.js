export class Alert {
    alertId;
    level;
    title;
    message;
    componentId;
    raisedAt;
    acknowledgedAt;
    metadata;
    constructor(input) {
        this.alertId = input.alertId.trim();
        this.level = input.level;
        this.title = input.title.trim();
        this.message = input.message.trim();
        this.componentId = input.componentId ?? null;
        this.raisedAt = input.raisedAt ?? new Date().toISOString();
        this.acknowledgedAt = input.acknowledgedAt ?? null;
        this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
        if (!this.alertId || !this.title || !this.message) {
            throw new Error("Alert requires alertId, title, and message");
        }
        Object.freeze(this);
    }
}
