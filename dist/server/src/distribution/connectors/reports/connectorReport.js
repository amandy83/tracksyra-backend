export class ConnectorReport {
    reportId;
    connectorId;
    releaseId;
    reportType;
    generatedAt;
    payload;
    constructor(input) {
        this.reportId = input.reportId.trim();
        this.connectorId = input.connectorId.trim();
        this.releaseId = input.releaseId.trim();
        this.reportType = input.reportType.trim();
        this.generatedAt = input.generatedAt ?? new Date().toISOString();
        this.payload = Object.freeze({ ...(input.payload ?? {}) });
        if (!this.reportId || !this.connectorId || !this.releaseId || !this.reportType) {
            throw new Error("ConnectorReport requires non-empty identifiers and reportType");
        }
        Object.freeze(this);
    }
}
