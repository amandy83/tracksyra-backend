export class AuditEvent {
    auditId;
    source;
    eventType;
    occurredAt;
    actor;
    metadata;
    constructor(input) {
        this.auditId = input.auditId.trim();
        this.source = input.source.trim();
        this.eventType = input.eventType.trim();
        this.occurredAt = input.occurredAt ?? new Date().toISOString();
        this.actor = input.actor ?? null;
        this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
        if (!this.auditId || !this.source || !this.eventType) {
            throw new Error("AuditEvent requires auditId, source, and eventType");
        }
        Object.freeze(this);
    }
}
