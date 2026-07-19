import type { ValidationPipeline, ValidationRegistry } from "../contracts/validationContracts";
import {
  ValidationContext,
  ValidationError,
  ValidationPlan,
  ValidationReport,
  ValidationResult,
  ValidationScope,
  ValidationSummary,
  ValidationWarning,
} from "../types/validationTypes";

function ensure(value: string, field: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`${field} must not be empty`);
  }
  return trimmed;
}

function aggregateErrors(results: readonly ValidationResult[]): readonly ValidationError[] {
  return Object.freeze(results.flatMap((result) => result.errors));
}

function aggregateWarnings(results: readonly ValidationResult[]): readonly ValidationWarning[] {
  return Object.freeze(results.flatMap((result) => result.warnings));
}

export class ValidationPipelineImpl implements ValidationPipeline {
  constructor(private readonly registry: ValidationRegistry) {}

  async run(context: ValidationContext, plan: ValidationPlan): Promise<ValidationReport> {
    const validatorIds = plan.validators.length ? plan.validators : this.registry.list().map((validator) => validator.validatorId);
    const results: ValidationResult[] = [];

    for (const validatorId of validatorIds) {
      const validator = this.registry.resolve(validatorId);
      if (!validator) {
        results.push(new ValidationResult({
          resultId: `${plan.planId}:${validatorId}:missing`,
          validator: validatorId,
          valid: false,
          errors: [new ValidationError({
            errorId: `${plan.planId}:${validatorId}:error`,
            code: "VALIDATOR_MISSING",
            message: `Validator ${validatorId} is not registered`,
            validator: validatorId,
            severity: "Critical",
            details: { validatorId },
          })],
          metadata: plan.metadata,
        }));
        if (plan.strict) {
          break;
        }
        continue;
      }
      const result = await validator.validate(context);
      results.push(result);
      if (plan.strict && !result.valid) {
        break;
      }
    }

    const errors = aggregateErrors(results);
    const warnings = aggregateWarnings(results);
    const valid = results.every((result) => result.valid);
    const summary = new ValidationSummary({
      summaryId: `${plan.planId}:summary`,
      totalChecks: results.length,
      validChecks: results.filter((result) => result.valid).length,
      invalidChecks: results.filter((result) => !result.valid).length,
      errorCount: errors.length,
      warningCount: warnings.length,
      criticalCount: errors.filter((error) => error.severity === "Critical").length,
      metadata: plan.metadata,
    });

    return new ValidationReport({
      reportId: `${plan.planId}:report`,
      scope: plan.scope,
      summary,
      results,
      valid,
      errors,
      warnings,
      metadata: plan.metadata,
    });
  }
}

