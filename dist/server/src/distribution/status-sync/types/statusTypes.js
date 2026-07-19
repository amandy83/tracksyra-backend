export class StatusTransition {
    releaseId;
    from;
    to;
    source;
    reason;
    requestedAt;
    appliedAt;
    metadata;
    constructor(input) {
        this.releaseId = input.releaseId.trim();
        this.from = input.from ?? null;
        this.to = input.to;
        this.source = input.source;
        this.reason = input.reason ?? null;
        this.requestedAt = input.requestedAt ?? new Date().toISOString();
        this.appliedAt = input.appliedAt ?? null;
        this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
        if (!this.releaseId) {
            throw new Error("StatusTransition.releaseId must not be empty");
        }
        Object.freeze(this);
    }
}
export class StatusEvidence {
    releaseId;
    providerReference;
    observedStatus;
    source;
    observedAt;
    correlationId;
    eventId;
    metadata;
    constructor(input) {
        this.releaseId = input.releaseId.trim();
        this.providerReference = input.providerReference ?? null;
        this.observedStatus = input.observedStatus.trim();
        this.source = input.source;
        this.observedAt = input.observedAt ?? new Date().toISOString();
        this.correlationId = input.correlationId ?? null;
        this.eventId = input.eventId ?? null;
        this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
        if (!this.releaseId || !this.observedStatus) {
            throw new Error("StatusEvidence requires releaseId and observedStatus");
        }
        Object.freeze(this);
    }
}
