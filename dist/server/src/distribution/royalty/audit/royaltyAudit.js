export class RoyaltyAudit {
    auditId;
    releaseId;
    eventType;
    recordedAt;
    metadata;
    constructor(input) {
        this.auditId = input.auditId.trim();
        this.releaseId = input.releaseId.trim();
        this.eventType = input.eventType.trim();
        this.recordedAt = input.recordedAt ?? new Date().toISOString();
        this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
        if (!this.auditId || !this.releaseId || !this.eventType) {
            throw new Error("RoyaltyAudit requires non-empty identifiers and eventType");
        }
        Object.freeze(this);
    }
}
