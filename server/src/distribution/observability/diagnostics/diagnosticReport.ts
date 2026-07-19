import type { ObservabilityMetadata } from "../types/observabilityTypes";

export class DiagnosticReport {
  readonly reportId: string;
  readonly scope: string;
  readonly summary: string;
  readonly generatedAt: string;
  readonly findings: readonly string[];
  readonly metadata: ObservabilityMetadata;

  constructor(input: {
    reportId: string;
    scope: string;
    summary: string;
    generatedAt?: string;
    findings?: readonly string[];
    metadata?: ObservabilityMetadata;
  }) {
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

