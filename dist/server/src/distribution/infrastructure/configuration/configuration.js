export class DistributionConfiguration {
    environment;
    workspaceRoot;
    storageRoot;
    metricsEnabled;
    constructor(environment, workspaceRoot, storageRoot, metricsEnabled = true) {
        this.environment = environment;
        this.workspaceRoot = workspaceRoot;
        this.storageRoot = storageRoot;
        this.metricsEnabled = metricsEnabled;
    }
}
export class MemoryProviderConfigurationStore {
    records = new Map();
    get(providerReference) {
        return this.records.get(providerReference) ?? null;
    }
    set(providerReference, configuration) {
        this.records.set(providerReference, { ...configuration });
    }
}
export class StaticFeatureFlagProvider {
    flags;
    constructor(flags) {
        this.flags = flags;
    }
    isEnabled(flag) {
        return this.flags[flag] ?? false;
    }
}
export class FileProviderConfigurationStore {
    store;
    constructor(store) {
        this.store = store;
    }
    async get(providerReference) {
        return await this.store.read(this.keyFor(providerReference));
    }
    async set(providerReference, configuration) {
        await this.store.write(this.keyFor(providerReference), configuration);
    }
    keyFor(providerReference) {
        return `providers/configuration/${providerReference}.json`;
    }
}
