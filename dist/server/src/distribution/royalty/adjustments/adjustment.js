export class Adjustment {
    adjustmentId;
    releaseId;
    ledgerId;
    amount;
    currency;
    reason;
    appliedAt;
    metadata;
    constructor(input) {
        this.adjustmentId = input.adjustmentId.trim();
        this.releaseId = input.releaseId.trim();
        this.ledgerId = input.ledgerId ?? null;
        this.amount = input.amount;
        this.currency = input.currency.trim().toUpperCase();
        this.reason = input.reason.trim();
        this.appliedAt = input.appliedAt ?? new Date().toISOString();
        this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
        if (!this.adjustmentId || !this.releaseId || !this.reason || !this.currency) {
            throw new Error("Adjustment requires non-empty identifiers, reason, and currency");
        }
        Object.freeze(this);
    }
}
