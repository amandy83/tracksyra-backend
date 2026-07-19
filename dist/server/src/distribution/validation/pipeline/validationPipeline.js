import { ValidationError, ValidationReport, ValidationResult, ValidationSummary, } from "../types/validationTypes.js";
function ensure(value, field) {
    const trimmed = value.trim();
    if (!trimmed) {
        throw new Error(`${field} must not be empty`);
    }
    return trimmed;
}
function aggregateErrors(results) {
    return Object.freeze(results.flatMap((result) => result.errors));
}
function aggregateWarnings(results) {
    return Object.freeze(results.flatMap((result) => result.warnings));
}
export class ValidationPipelineImpl {
    registry;
    constructor(registry) {
        this.registry = registry;
    }
    async run(context, plan) {
        const validatorIds = plan.validators.length ? plan.validators : this.registry.list().map((validator) => validator.validatorId);
        const results = [];
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
