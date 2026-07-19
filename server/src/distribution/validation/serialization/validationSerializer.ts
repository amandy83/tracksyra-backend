import {
  ValidationContext,
  ValidationError,
  ValidationPlan,
  ValidationReport,
  ValidationResult,
  ValidationSummary,
  ValidationWarning,
} from "../types/validationTypes";
import { serializeCanonicalJSON } from "../../core/canonicalSerializer";

export class ValidationSerializer {
  serialize(value: unknown): string {
    return serializeCanonicalJSON(value);
  }

  deserializeContext(payload: string): ValidationContext {
    return Object.freeze(JSON.parse(payload) as ValidationContext);
  }

  deserializePlan(payload: string): ValidationPlan {
    return Object.freeze(JSON.parse(payload) as ValidationPlan);
  }

  deserializeResult(payload: string): ValidationResult {
    return Object.freeze(JSON.parse(payload) as ValidationResult);
  }

  deserializeReport(payload: string): ValidationReport {
    return Object.freeze(JSON.parse(payload) as ValidationReport);
  }

  deserializeSummary(payload: string): ValidationSummary {
    return Object.freeze(JSON.parse(payload) as ValidationSummary);
  }

  deserializeError(payload: string): ValidationError {
    return Object.freeze(JSON.parse(payload) as ValidationError);
  }

  deserializeWarning(payload: string): ValidationWarning {
    return Object.freeze(JSON.parse(payload) as ValidationWarning);
  }
}
