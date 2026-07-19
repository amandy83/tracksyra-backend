export class ConnectorSubmission {
    submissionId;
    connectorId;
    releaseId;
    submittedAt;
    accepted;
    metadata;
    constructor(input) {
        this.submissionId = input.submissionId.trim();
        this.connectorId = input.connectorId.trim();
        this.releaseId = input.releaseId.trim();
        this.submittedAt = input.submittedAt ?? new Date().toISOString();
        this.accepted = input.accepted ?? false;
        this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
        if (!this.submissionId || !this.connectorId || !this.releaseId) {
            throw new Error("ConnectorSubmission requires non-empty identifiers");
        }
        Object.freeze(this);
    }
}
