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
export class ValidationEvent {
    eventId;
    eventType;
    scope;
    validator;
    occurredAt;
    payload;
    metadata;
    constructor(input) {
        this.eventId = ensure(input.eventId, "eventId");
        this.eventType = input.eventType;
        this.scope = input.scope;
        this.validator = input.validator ?? null;
        this.occurredAt = input.occurredAt ?? new Date().toISOString();
        this.payload = Object.freeze({ ...(input.payload ?? {}) });
        this.metadata = freezeMetadata((input.metadata ?? {}));
        Object.freeze(this);
    }
}
export class ValidationRequestedEvent extends ValidationEvent {
    constructor(input) {
        super({ ...input, eventType: "ValidationRequested" });
    }
}
export class ValidationScheduledEvent extends ValidationEvent {
    constructor(input) {
        super({ ...input, eventType: "ValidationScheduled" });
    }
}
export class ValidationStartedEvent extends ValidationEvent {
    constructor(input) {
        super({ ...input, eventType: "ValidationStarted" });
    }
}
export class ValidationCompletedEvent extends ValidationEvent {
    constructor(input) {
        super({ ...input, eventType: "ValidationCompleted" });
    }
}
export class ValidationFailedEvent extends ValidationEvent {
    constructor(input) {
        super({ ...input, eventType: "ValidationFailed" });
    }
}
