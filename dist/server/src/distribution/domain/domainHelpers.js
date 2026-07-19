import { DomainInvariantError } from "./domainErrors.js";
export function nowIso() {
    return new Date().toISOString();
}
export function normalizeToken(value, field, min = 1, max = 128) {
    const normalized = value.trim();
    if (normalized.length < min || normalized.length > max) {
        throw new DomainInvariantError(`${field} must be between ${min} and ${max} characters`, { field, value });
    }
    if (!/^[A-Za-z0-9._:/\-@+]+$/.test(normalized)) {
        throw new DomainInvariantError(`${field} contains invalid characters`, { field, value });
    }
    return normalized;
}
export function normalizeOptionalText(value, field, max = 256) {
    if (value == null)
        return null;
    const normalized = value.trim();
    if (!normalized)
        return null;
    if (normalized.length > max) {
        throw new DomainInvariantError(`${field} must be at most ${max} characters`, { field, value });
    }
    return normalized;
}
export function normalizeText(value, field, max = 256) {
    const normalized = value.trim();
    if (!normalized) {
        throw new DomainInvariantError(`${field} must not be empty`, { field, value });
    }
    if (normalized.length > max) {
        throw new DomainInvariantError(`${field} must be at most ${max} characters`, { field, value });
    }
    return normalized;
}
export function normalizePositiveInteger(value, field) {
    if (!Number.isInteger(value) || value <= 0) {
        throw new DomainInvariantError(`${field} must be a positive integer`, { field, value });
    }
    return value;
}
export function normalizeNonNegativeInteger(value, field) {
    if (!Number.isInteger(value) || value < 0) {
        throw new DomainInvariantError(`${field} must be a non-negative integer`, { field, value });
    }
    return value;
}
export function normalizePercentage(value, field) {
    if (!Number.isFinite(value) || value < 0 || value > 100) {
        throw new DomainInvariantError(`${field} must be between 0 and 100`, { field, value });
    }
    return value;
}
export function ensure(condition, message, details = {}) {
    if (!condition)
        throw new DomainInvariantError(message, details);
}
export function freeze(value) {
    return Object.freeze(value);
}
