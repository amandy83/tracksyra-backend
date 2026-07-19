export class CurrencyRate {
    rateId;
    baseCurrency;
    quoteCurrency;
    rate;
    effectiveAt;
    metadata;
    constructor(input) {
        this.rateId = input.rateId.trim();
        this.baseCurrency = input.baseCurrency.trim().toUpperCase();
        this.quoteCurrency = input.quoteCurrency.trim().toUpperCase();
        this.rate = input.rate;
        this.effectiveAt = input.effectiveAt ?? new Date().toISOString();
        this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
        if (!this.rateId || !this.baseCurrency || !this.quoteCurrency) {
            throw new Error("CurrencyRate requires non-empty identifiers and currency codes");
        }
        if (!Number.isFinite(this.rate) || this.rate <= 0) {
            throw new Error("CurrencyRate.rate must be positive");
        }
        Object.freeze(this);
    }
}
