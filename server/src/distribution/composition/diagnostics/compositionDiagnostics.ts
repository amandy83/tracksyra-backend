import type { ValidationReport } from "../types/compositionTypes";

export interface CompositionDiagnosticRegistry {
  record(report: ValidationReport): void;
  list(): readonly ValidationReport[];
}
