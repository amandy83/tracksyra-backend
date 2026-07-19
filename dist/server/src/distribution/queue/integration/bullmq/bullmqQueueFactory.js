export class BullMQQueueFactory {
    registry;
    constructor(registry) {
        this.registry = registry;
    }
    create(configuration) {
        const existing = this.registry.get(configuration.queueName)?.adapter;
        if (existing)
            return existing;
        if (!this.supports(configuration.adapter)) {
            throw new Error(`Unsupported queue adapter: ${configuration.adapter}`);
        }
        throw new Error(`Queue adapter not registered: ${configuration.queueName}`);
    }
    resolve(adapter) {
        const entry = this.registry.list().find((candidate) => candidate.adapterName === adapter);
        return entry?.adapter ?? null;
    }
    supports(adapter) {
        return adapter === "BullMQ";
    }
    get queueRegistry() {
        return this.registry;
    }
}
