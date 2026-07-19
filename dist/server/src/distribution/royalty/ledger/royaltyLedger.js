export class RoyaltyLedger {
    ledgerId;
    releaseId;
    connectorId;
    currency;
    entries;
    grossRevenue;
    netRevenue;
    version;
    createdAt;
    metadata;
    constructor(input) {
        this.ledgerId = input.ledgerId.trim();
        this.releaseId = input.releaseId.trim();
        this.connectorId = input.connectorId ?? null;
        this.currency = input.currency.trim().toUpperCase();
        this.entries = Object.freeze([...(input.entries ?? [])]);
        this.grossRevenue = input.grossRevenue;
        this.netRevenue = input.netRevenue;
        this.version = input.version ?? 1;
        this.createdAt = input.createdAt ?? new Date().toISOString();
        this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
        if (!this.ledgerId || !this.releaseId || !this.currency) {
            throw new Error("RoyaltyLedger requires non-empty identifiers and currency");
        }
        if (!Number.isInteger(this.version) || this.version < 1) {
            throw new Error("RoyaltyLedger.version must be a positive integer");
        }
        Object.freeze(this);
    }
}
