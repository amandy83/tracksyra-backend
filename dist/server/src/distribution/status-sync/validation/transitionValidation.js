export class TransitionValidationResult {
    releaseId;
    valid;
    previousState;
    nextState;
    reason;
    validatedAt;
    metadata;
    constructor(input) {
        this.releaseId = input.releaseId.trim();
        this.valid = input.valid;
        this.previousState = input.previousState ?? null;
        this.nextState = input.nextState;
        this.reason = input.reason ?? null;
        this.validatedAt = input.validatedAt ?? new Date().toISOString();
        this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
        if (!this.releaseId) {
            throw new Error("TransitionValidationResult.releaseId must not be empty");
        }
        Object.freeze(this);
    }
}
