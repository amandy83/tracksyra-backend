import type { BootstrapReport } from "../types/bootstrapTypes";

export interface BootstrapDiagnosticReporter {
  report(report: BootstrapReport): void;
  list(): readonly BootstrapReport[];
}
