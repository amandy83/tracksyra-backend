export class ConnectorError extends Error {
    connectorId;
    code;
    retryable;
    metadata;
    constructor(input) {
        super(input.message);
        this.connectorId = input.connectorId.trim();
        this.code = input.code.trim();
        this.retryable = input.retryable ?? false;
        this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
        if (!this.connectorId || !this.code) {
            throw new Error("ConnectorError requires connectorId and code");
        }
        Object.freeze(this);
    }
}
