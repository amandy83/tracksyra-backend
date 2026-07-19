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

export type ValidationEventType =
  | "ValidationRequested"
  | "ValidationScheduled"
  | "ValidationStarted"
  | "ValidationCompleted"
  | "ValidationFailed"
  | "ValidationWarningRaised"
  | "ValidationMetricRecorded"
  | "ValidationLogRecorded";

export class ValidationEvent<TMetadata extends ValidationMetadata = ValidationMetadata> {
  readonly eventId: string;
  readonly eventType: ValidationEventType;
  readonly scope: ValidationScope;
  readonly validator: string | null;
  readonly occurredAt: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly metadata: TMetadata;

  constructor(input: {
    eventId: string;
    eventType: ValidationEventType;
    scope: ValidationScope;
    validator?: string | null;
    occurredAt?: string;
    payload?: Readonly<Record<string, unknown>>;
    metadata?: TMetadata;
  }) {
    this.eventId = ensure(input.eventId, "eventId");
    this.eventType = input.eventType;
    this.scope = input.scope;
    this.validator = input.validator ?? null;
    this.occurredAt = input.occurredAt ?? new Date().toISOString();
    this.payload = Object.freeze({ ...(input.payload ?? {}) });
    this.metadata = freezeMetadata((input.metadata ?? {}) as TMetadata);
    Object.freeze(this);
  }
}

export class ValidationRequestedEvent<TMetadata extends ValidationMetadata = ValidationMetadata> extends ValidationEvent<TMetadata> {
  constructor(input: ConstructorParameters<typeof ValidationEvent<TMetadata>>[0]) {
    super({ ...input, eventType: "ValidationRequested" });
  }
}

export class ValidationScheduledEvent<TMetadata extends ValidationMetadata = ValidationMetadata> extends ValidationEvent<TMetadata> {
  constructor(input: ConstructorParameters<typeof ValidationEvent<TMetadata>>[0]) {
    super({ ...input, eventType: "ValidationScheduled" });
  }
}

export class ValidationStartedEvent<TMetadata extends ValidationMetadata = ValidationMetadata> extends ValidationEvent<TMetadata> {
  constructor(input: ConstructorParameters<typeof ValidationEvent<TMetadata>>[0]) {
    super({ ...input, eventType: "ValidationStarted" });
  }
}

export class ValidationCompletedEvent<TMetadata extends ValidationMetadata = ValidationMetadata> extends ValidationEvent<TMetadata> {
  constructor(input: ConstructorParameters<typeof ValidationEvent<TMetadata>>[0]) {
    super({ ...input, eventType: "ValidationCompleted" });
  }
}

export class ValidationFailedEvent<TMetadata extends ValidationMetadata = ValidationMetadata> extends ValidationEvent<TMetadata> {
  constructor(input: ConstructorParameters<typeof ValidationEvent<TMetadata>>[0]) {
    super({ ...input, eventType: "ValidationFailed" });
  }
}

