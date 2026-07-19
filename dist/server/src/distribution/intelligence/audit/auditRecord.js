export class AuditRecord {
    recordId;
    releaseId;
    eventType;
    recordedAt;
    payload;
    metadata;
    constructor(input) {
        this.recordId = input.recordId.trim();
        this.releaseId = input.releaseId.trim();
        this.eventType = input.eventType.trim();
        this.recordedAt = input.recordedAt ?? new Date().toISOString();
        this.payload = Object.freeze({ ...(input.payload ?? {}) });
        this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
        if (!this.recordId || !this.releaseId || !this.eventType) {
            throw new Error("AuditRecord requires recordId, releaseId, and eventType");
        }
        Object.freeze(this);
    }
}
