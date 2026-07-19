export class QueueRegistryEntry {
    name;
    adapterName;
    configuration;
    adapter;
    registeredAt;
    metadata;
    constructor(input) {
        this.name = input.name.trim();
        this.adapterName = input.adapterName.trim();
        this.configuration = input.configuration;
        this.adapter = input.adapter;
        this.registeredAt = input.registeredAt ?? new Date().toISOString();
        this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
        if (!this.name || !this.adapterName) {
            throw new Error("QueueRegistryEntry requires non-empty values");
        }
        Object.freeze(this);
    }
}
