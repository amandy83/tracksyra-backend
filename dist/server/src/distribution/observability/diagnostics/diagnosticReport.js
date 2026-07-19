export class DiagnosticReport {
    reportId;
    scope;
    summary;
    generatedAt;
    findings;
    metadata;
    constructor(input) {
        this.reportId = input.reportId.trim();
        this.scope = input.scope.trim();
        this.summary = input.summary.trim();
        this.generatedAt = input.generatedAt ?? new Date().toISOString();
        this.findings = Object.freeze([...(input.findings ?? [])]);
        this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
        if (!this.reportId || !this.scope || !this.summary) {
            throw new Error("DiagnosticReport requires reportId, scope, and summary");
        }
        Object.freeze(this);
    }
}
