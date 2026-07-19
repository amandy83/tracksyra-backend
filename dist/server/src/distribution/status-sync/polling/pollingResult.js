export class PollingResult {
    releaseId;
    providerReference;
    polledAt;
    snapshot;
    changesDetected;
    transitions;
    nextPollAt;
    warnings;
    errors;
    metadata;
    constructor(input) {
        this.releaseId = input.releaseId.trim();
        this.providerReference = input.providerReference ?? null;
        this.polledAt = input.polledAt ?? new Date().toISOString();
        this.snapshot = input.snapshot;
        this.changesDetected = input.changesDetected;
        this.transitions = Object.freeze([...(input.transitions ?? [])]);
        this.nextPollAt = input.nextPollAt ?? null;
        this.warnings = Object.freeze([...(input.warnings ?? [])]);
        this.errors = Object.freeze([...(input.errors ?? [])]);
        this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
        if (!this.releaseId) {
            throw new Error("PollingResult.releaseId must not be empty");
        }
        Object.freeze(this);
    }
}
