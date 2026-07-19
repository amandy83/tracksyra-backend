export class ConnectorRetry {
    connectorId;
    releaseId;
    retryCount;
    lastAttemptAt;
    nextAttemptAt;
    metadata;
    constructor(input) {
        this.connectorId = input.connectorId.trim();
        this.releaseId = input.releaseId.trim();
        this.retryCount = input.retryCount ?? 0;
        this.lastAttemptAt = input.lastAttemptAt ?? null;
        this.nextAttemptAt = input.nextAttemptAt ?? null;
        this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
        if (!this.connectorId || !this.releaseId) {
            throw new Error("ConnectorRetry requires non-empty identifiers");
        }
        if (!Number.isInteger(this.retryCount) || this.retryCount < 0) {
            throw new Error("ConnectorRetry.retryCount must be a non-negative integer");
        }
        Object.freeze(this);
    }
}
