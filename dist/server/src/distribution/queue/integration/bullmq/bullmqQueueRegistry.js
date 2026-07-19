import { QueueRegistryEntry } from "../registry/queueRegistry.js";
export class BullMQQueueRegistry {
    entries = new Map();
    register(entry) {
        this.entries.set(entry.name, entry);
    }
    resolve(name) {
        return this.entries.get(name)?.adapter ?? null;
    }
    get(name) {
        return this.entries.get(name) ?? null;
    }
    list() {
        return Object.freeze([...this.entries.values()]);
    }
    registerAdapter(input) {
        const entry = new QueueRegistryEntry({
            name: input.name,
            adapterName: input.adapterName,
            configuration: input.configuration,
            adapter: input.adapter,
            metadata: input.metadata,
        });
        this.register(entry);
        return entry;
    }
}
