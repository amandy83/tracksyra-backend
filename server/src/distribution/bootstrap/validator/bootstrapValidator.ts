import type { DependencyValidationResult } from "../types/bootstrapTypes";
import type { DependencyGraph } from "../../composition";

export interface BootstrapDependencyValidator {
  validate(graph: DependencyGraph): Promise<DependencyValidationResult> | DependencyValidationResult;
}
