export class RoyaltyReconciliation {
    reconciliationId;
    ledgerId;
    releaseId;
    balanced;
    discrepancies;
    reconciledAt;
    metadata;
    constructor(input) {
        this.reconciliationId = input.reconciliationId.trim();
        this.ledgerId = input.ledgerId.trim();
        this.releaseId = input.releaseId.trim();
        this.balanced = input.balanced;
        this.discrepancies = Object.freeze([...(input.discrepancies ?? [])]);
        this.reconciledAt = input.reconciledAt ?? new Date().toISOString();
        this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
        if (!this.reconciliationId || !this.ledgerId || !this.releaseId) {
            throw new Error("RoyaltyReconciliation requires non-empty identifiers");
        }
        Object.freeze(this);
    }
}
