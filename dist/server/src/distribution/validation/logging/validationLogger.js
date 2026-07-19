function ensure(value, field) {
    const trimmed = value.trim();
    if (!trimmed) {
        throw new Error(`${field} must not be empty`);
    }
    return trimmed;
}
function freezeMetadata(metadata) {
    return Object.freeze({ ...metadata });
}
export class ValidationLogEntry {
    logId;
    level;
    message;
    scope;
    validator;
    loggedAt;
    metadata;
    constructor(input) {
        this.logId = ensure(input.logId, "logId");
        this.level = input.level;
        this.message = ensure(input.message, "message");
        this.scope = input.scope;
        this.validator = input.validator ?? null;
        this.loggedAt = input.loggedAt ?? new Date().toISOString();
        this.metadata = freezeMetadata((input.metadata ?? {}));
        Object.freeze(this);
    }
}
export class ValidationLogger {
    entries = [];
    log(entry) {
        this.entries.push(entry);
    }
    create(level, message, scope, validator, metadata = {}) {
        return new ValidationLogEntry({
            logId: `validation-log:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 8)}`,
            level,
            message,
            scope,
            validator: validator ?? null,
            metadata,
        });
    }
    list() {
        return Object.freeze([...this.entries]);
    }
}
