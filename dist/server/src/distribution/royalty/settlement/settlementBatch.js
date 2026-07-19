export class SettlementBatch {
    settlementId;
    releaseId;
    ledgerId;
    calculation;
    currency;
    netRevenue;
    artistShare;
    paymentRequested;
    createdAt;
    metadata;
    constructor(input) {
        this.settlementId = input.settlementId.trim();
        this.releaseId = input.releaseId.trim();
        this.ledgerId = input.ledgerId.trim();
        this.calculation = input.calculation;
        this.currency = input.currency.trim().toUpperCase();
        this.netRevenue = input.netRevenue;
        this.artistShare = input.artistShare;
        this.paymentRequested = input.paymentRequested ?? false;
        this.createdAt = input.createdAt ?? new Date().toISOString();
        this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
        if (!this.settlementId || !this.releaseId || !this.ledgerId || !this.currency) {
            throw new Error("SettlementBatch requires non-empty identifiers and currency");
        }
        Object.freeze(this);
    }
}
