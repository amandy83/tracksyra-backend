export class BullMQQueueConfigurationProvider {
    configurations = new Map();
    load(adapter, queueName) {
        return this.configurations.get(this.key(adapter, queueName)) ?? null;
    }
    save(configuration) {
        this.configurations.set(this.key(configuration.adapter, configuration.queueName), configuration);
    }
    list(adapter) {
        const values = [...this.configurations.values()];
        return adapter ? values.filter((configuration) => configuration.adapter === adapter) : values;
    }
    key(adapter, queueName) {
        return `${adapter}:${queueName}`;
    }
}
