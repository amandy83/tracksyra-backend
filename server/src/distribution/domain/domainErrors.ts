export class DomainError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details: Readonly<Record<string, unknown>> = {},
  ) {
    super(message);
    this.name = "DomainError";
  }
}

export class DomainInvariantError extends DomainError {
  constructor(message: string, details: Readonly<Record<string, unknown>> = {}) {
    super(message, "DOMAIN_INVARIANT_VIOLATION", details);
    this.name = "DomainInvariantError";
  }
}

