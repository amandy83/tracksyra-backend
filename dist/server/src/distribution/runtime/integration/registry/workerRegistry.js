export class WorkerRegistryEntry {
    workerId;
    runtime;
    configuration;
    registeredAt;
    metadata;
    constructor(input) {
        this.workerId = input.workerId.trim();
        this.runtime = input.runtime;
        this.configuration = input.configuration;
        this.registeredAt = input.registeredAt ?? new Date().toISOString();
        this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
        if (!this.workerId) {
            throw new Error("WorkerRegistryEntry.workerId must not be empty");
        }
        Object.freeze(this);
    }
}
