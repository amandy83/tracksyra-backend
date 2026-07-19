import type { CompositionSnapshot, ValidationReport } from "../types/compositionTypes";

export interface CompositionStartupValidator {
  validate(snapshot: CompositionSnapshot): Promise<ValidationReport> | ValidationReport;
}
