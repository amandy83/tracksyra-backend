import type { ValidationMetadata, ValidationScope } from "../types/validationTypes";

function ensure(value: string, field: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`${field} must not be empty`);
  }
  return trimmed;
}

function freezeMetadata<T extends ValidationMetadata>(metadata: T): T {
  return Object.freeze({ ...metadata }) as T;
}

export class ValidationMetric<TMetadata extends ValidationMetadata = ValidationMetadata> {
  readonly metricId: string;
  readonly name: string;
  readonly scope: ValidationScope;
  readonly value: number;
  readonly recordedAt: string;
  readonly metadata: TMetadata;

  constructor(input: {
    metricId: string;
    name: string;
    scope: ValidationScope;
    value: number;
    recordedAt?: string;
    metadata?: TMetadata;
  }) {
    this.metricId = ensure(input.metricId, "metricId");
    this.name = ensure(input.name, "name");
    this.scope = input.scope;
    this.value = input.value;
    this.recordedAt = input.recordedAt ?? new Date().toISOString();
    this.metadata = freezeMetadata((input.metadata ?? {}) as TMetadata);
    if (!Number.isFinite(this.value)) {
      throw new Error("ValidationMetric.value must be finite");
    }
    Object.freeze(this);
  }
}

export class ValidationMetrics {
  private readonly metrics: ValidationMetric[] = [];

  record(metric: ValidationMetric): void {
    this.metrics.push(metric);
  }

  create(name: string, scope: ValidationScope, value: number, metadata: ValidationMetadata = {}): ValidationMetric {
    return new ValidationMetric({
      metricId: `validation-metric:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 8)}`,
      name,
      scope,
      value,
      metadata,
    });
  }

  list(): readonly ValidationMetric[] {
    return Object.freeze([...this.metrics]);
  }
}

