export class DiagnosticReport {
    reportId;
    scope;
    generatedAt;
    findings;
    metadata;
    constructor(input) {
        this.reportId = input.reportId.trim();
        this.scope = input.scope.trim();
        this.generatedAt = input.generatedAt ?? new Date().toISOString();
        this.findings = Object.freeze([...(input.findings ?? [])]);
        this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
        if (!this.reportId || !this.scope) {
            throw new Error("DiagnosticReport requires reportId and scope");
        }
        Object.freeze(this);
    }
}
