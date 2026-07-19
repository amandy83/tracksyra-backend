export class DomainError extends Error {
    code;
    details;
    constructor(message, code, details = {}) {
        super(message);
        this.code = code;
        this.details = details;
        this.name = "DomainError";
    }
}
export class DomainInvariantError extends DomainError {
    constructor(message, details = {}) {
        super(message, "DOMAIN_INVARIANT_VIOLATION", details);
        this.name = "DomainInvariantError";
    }
}
