export class RevenueCalculation {
    calculationId;
    ledgerId;
    releaseId;
    grossRevenue;
    platformFees;
    taxes;
    adjustments;
    netRevenue;
    artistShare;
    currency;
    calculatedAt;
    metadata;
    constructor(input) {
        this.calculationId = input.calculationId.trim();
        this.ledgerId = input.ledgerId.trim();
        this.releaseId = input.releaseId.trim();
        this.grossRevenue = input.grossRevenue;
        this.platformFees = input.platformFees;
        this.taxes = input.taxes;
        this.adjustments = input.adjustments;
        this.netRevenue = input.netRevenue;
        this.artistShare = input.artistShare;
        this.currency = input.currency.trim().toUpperCase();
        this.calculatedAt = input.calculatedAt ?? new Date().toISOString();
        this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
        if (!this.calculationId || !this.ledgerId || !this.releaseId || !this.currency) {
            throw new Error("RevenueCalculation requires non-empty identifiers and currency");
        }
        Object.freeze(this);
    }
}
