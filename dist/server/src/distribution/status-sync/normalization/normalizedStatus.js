export class NormalizedStatus {
    releaseId;
    providerReference;
    canonicalState;
    rawStatus;
    source;
    normalizedAt;
    confidence;
    evidence;
    metadata;
    constructor(input) {
        this.releaseId = input.releaseId.trim();
        this.providerReference = input.providerReference ?? null;
        this.canonicalState = input.canonicalState;
        this.rawStatus = input.rawStatus.trim();
        this.source = input.source;
        this.normalizedAt = input.normalizedAt ?? new Date().toISOString();
        this.confidence = input.confidence ?? 1;
        this.evidence = input.evidence ?? null;
        this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
        if (!this.releaseId || !this.rawStatus) {
            throw new Error("NormalizedStatus requires releaseId and rawStatus");
        }
        if (!Number.isFinite(this.confidence) || this.confidence < 0 || this.confidence > 1) {
            throw new Error("NormalizedStatus.confidence must be between 0 and 1");
        }
        Object.freeze(this);
    }
}
