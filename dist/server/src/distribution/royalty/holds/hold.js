export class Hold {
    holdId;
    releaseId;
    reason;
    active;
    appliedAt;
    releasedAt;
    metadata;
    constructor(input) {
        this.holdId = input.holdId.trim();
        this.releaseId = input.releaseId.trim();
        this.reason = input.reason.trim();
        this.active = input.active ?? true;
        this.appliedAt = input.appliedAt ?? new Date().toISOString();
        this.releasedAt = input.releasedAt ?? null;
        this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
        if (!this.holdId || !this.releaseId || !this.reason) {
            throw new Error("Hold requires non-empty identifiers and reason");
        }
        Object.freeze(this);
    }
}
