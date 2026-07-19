export class Statement {
    statementId;
    releaseId;
    settlementBatchId;
    periodStart;
    periodEnd;
    currency;
    amount;
    generatedAt;
    metadata;
    constructor(input) {
        this.statementId = input.statementId.trim();
        this.releaseId = input.releaseId.trim();
        this.settlementBatchId = input.settlementBatch.settlementId;
        this.periodStart = input.periodStart.trim();
        this.periodEnd = input.periodEnd.trim();
        this.currency = input.currency.trim().toUpperCase();
        this.amount = input.amount;
        this.generatedAt = input.generatedAt ?? new Date().toISOString();
        this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
        if (!this.statementId || !this.releaseId || !this.settlementBatchId || !this.currency) {
            throw new Error("Statement requires non-empty identifiers and currency");
        }
        Object.freeze(this);
    }
}
