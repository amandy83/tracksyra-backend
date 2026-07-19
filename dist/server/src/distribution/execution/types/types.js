export class ImmutableExecutionCancellationToken {
    cancelled;
    reason;
    constructor(input = {}) {
        this.cancelled = input.cancelled ?? false;
        this.reason = input.reason ?? null;
        Object.freeze(this);
    }
    throwIfCancelled() {
        if (this.cancelled) {
            throw new Error(this.reason ?? "Execution cancelled");
        }
    }
}
