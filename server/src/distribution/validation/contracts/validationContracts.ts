import type {
  ValidationContext,
  ValidationPlan,
  ValidationReport,
  ValidationResult,
  ValidationScope,
} from "../types/validationTypes";
import type { ValidationConfiguration } from "../configuration/validationConfiguration";
import type { ValidationEvent } from "../events/validationEvents";
import type { ValidationMetric } from "../metrics/validationMetrics";
import type { ValidationLogEntry } from "../logging/validationLogger";
import type { ValidationSerializer } from "../serialization/validationSerializer";

export interface Validator {
  readonly validatorId: string;
  validate(context: ValidationContext): Promise<ValidationResult> | ValidationResult;
}

export interface ValidationRegistry {
  register(validator: Validator): void;
  resolve(validatorId: string): Validator | null;
  list(): readonly Validator[];
}

export interface ValidationPipeline {
  run(context: ValidationContext, plan: ValidationPlan): Promise<ValidationReport> | ValidationReport;
}

export interface ValidationScheduler {
  schedule(context: ValidationContext, plan?: ValidationPlan | null): ValidationPlan;
}

export interface ValidationCoordinator {
  coordinate(context: ValidationContext, plan?: ValidationPlan | null): Promise<ValidationReport> | ValidationReport;
}

export interface ValidationEventPublisher {
  publish(event: ValidationEvent): Promise<void> | void;
}

export interface ValidationMetrics {
  record(metric: ValidationMetric): Promise<void> | void;
}

export interface ValidationLogger {
  log(entry: ValidationLogEntry): Promise<void> | void;
}

export interface ValidationConfigurationProvider {
  get(): ValidationConfiguration;
}

export interface ValidationRuntimeFactory {
  create(configuration?: Partial<ValidationConfiguration> | null): ValidationRuntime;
}

export interface ValidationRuntime {
  readonly registry: ValidationRegistry;
  readonly pipeline: ValidationPipeline;
  readonly scheduler: ValidationScheduler;
  readonly coordinator: ValidationCoordinator;
  readonly logger: ValidationLogger;
  readonly metrics: ValidationMetrics;
  readonly serializer: ValidationSerializer;
  readonly configurationProvider: ValidationConfigurationProvider;
  readonly eventPublisher: ValidationEventPublisher;
  validate(context: ValidationContext, plan?: ValidationPlan | null): Promise<ValidationReport> | ValidationReport;
  validateScope(scope: ValidationScope, context: ValidationContext, plan?: ValidationPlan | null): Promise<ValidationReport> | ValidationReport;
}

