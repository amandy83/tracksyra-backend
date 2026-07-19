import type { ValidationMetadata } from "../types/validationTypes";

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

export class ValidationConfiguration<TMetadata extends ValidationMetadata = ValidationMetadata> {
  readonly validationId: string;
  readonly strictMode: boolean;
  readonly failFast: boolean;
  readonly maxErrors: number;
  readonly maxWarnings: number;
  readonly enableMetrics: boolean;
  readonly enableLogging: boolean;
  readonly enableTracing: boolean;
  readonly metadata: TMetadata;

  constructor(input: {
    validationId: string;
    strictMode?: boolean;
    failFast?: boolean;
    maxErrors?: number;
    maxWarnings?: number;
    enableMetrics?: boolean;
    enableLogging?: boolean;
    enableTracing?: boolean;
    metadata?: TMetadata;
  }) {
    this.validationId = ensure(input.validationId, "validationId");
    this.strictMode = input.strictMode ?? true;
    this.failFast = input.failFast ?? true;
    this.maxErrors = input.maxErrors ?? 0;
    this.maxWarnings = input.maxWarnings ?? 0;
    this.enableMetrics = input.enableMetrics ?? true;
    this.enableLogging = input.enableLogging ?? true;
    this.enableTracing = input.enableTracing ?? true;
    this.metadata = freezeMetadata((input.metadata ?? {}) as TMetadata);
    if (!Number.isFinite(this.maxErrors) || this.maxErrors < 0) {
      throw new Error("ValidationConfiguration.maxErrors must be non-negative");
    }
    if (!Number.isFinite(this.maxWarnings) || this.maxWarnings < 0) {
      throw new Error("ValidationConfiguration.maxWarnings must be non-negative");
    }
    Object.freeze(this);
  }
}

