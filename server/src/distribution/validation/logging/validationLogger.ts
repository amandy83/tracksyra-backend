import type { ValidationMetadata, ValidationScope, ValidationSeverity } from "../types/validationTypes";

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

export class ValidationLogEntry<TMetadata extends ValidationMetadata = ValidationMetadata> {
  readonly logId: string;
  readonly level: ValidationSeverity;
  readonly message: string;
  readonly scope: ValidationScope;
  readonly validator: string | null;
  readonly loggedAt: string;
  readonly metadata: TMetadata;

  constructor(input: {
    logId: string;
    level: ValidationSeverity;
    message: string;
    scope: ValidationScope;
    validator?: string | null;
    loggedAt?: string;
    metadata?: TMetadata;
  }) {
    this.logId = ensure(input.logId, "logId");
    this.level = input.level;
    this.message = ensure(input.message, "message");
    this.scope = input.scope;
    this.validator = input.validator ?? null;
    this.loggedAt = input.loggedAt ?? new Date().toISOString();
    this.metadata = freezeMetadata((input.metadata ?? {}) as TMetadata);
    Object.freeze(this);
  }
}

export class ValidationLogger {
  private readonly entries: ValidationLogEntry[] = [];

  log(entry: ValidationLogEntry): void {
    this.entries.push(entry);
  }

  create(level: ValidationSeverity, message: string, scope: ValidationScope, validator?: string | null, metadata: ValidationMetadata = {}): ValidationLogEntry {
    return new ValidationLogEntry({
      logId: `validation-log:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 8)}`,
      level,
      message,
      scope,
      validator: validator ?? null,
      metadata,
    });
  }

  list(): readonly ValidationLogEntry[] {
    return Object.freeze([...this.entries]);
  }
}

