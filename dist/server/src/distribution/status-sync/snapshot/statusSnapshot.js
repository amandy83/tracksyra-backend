export class StatusSnapshot {
    releaseId;
    providerReference;
    current;
    previous;
    capturedAt;
    version;
    evidence;
    metadata;
    constructor(input) {
        this.releaseId = input.releaseId.trim();
        this.providerReference = input.providerReference ?? null;
        this.current = input.current;
        this.previous = input.previous ?? null;
        this.capturedAt = input.capturedAt ?? new Date().toISOString();
        this.version = input.version ?? 1;
        this.evidence = Object.freeze([...(input.evidence ?? [])]);
        this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
        if (!this.releaseId) {
            throw new Error("StatusSnapshot.releaseId must not be empty");
        }
        if (!Number.isInteger(this.version) || this.version < 1) {
            throw new Error("StatusSnapshot.version must be a positive integer");
        }
        Object.freeze(this);
    }
    get currentState() {
        return this.current.canonicalState;
    }
}
