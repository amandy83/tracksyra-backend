import { ProviderError } from "./providerError.js";
import { ProviderStatus } from "./providerStatus.js";
export class ProviderRegistry {
    entries = new Map();
    factory;
    validator;
    services;
    constructor(options) {
        this.factory = options.factory;
        this.validator = options.validator;
        this.services = Object.freeze({ ...options.services });
    }
    register(input) {
        this.validator.assertValid(this.validator.validateConfiguration(input.configuration), input.name, input.version);
        this.validator.assertValid(this.validator.validateCredentials(input.credentials), input.name, input.version);
        this.validator.assertValid(this.validator.validateCapabilities(input.capabilities), input.name, input.version);
        const byName = this.entries.get(input.name) ?? new Map();
        const next = Object.freeze({
            ...input,
            registeredAt: input.registeredAt ?? new Date(),
            updatedAt: new Date(),
        });
        byName.set(input.version, next);
        this.entries.set(input.name, byName);
        return next;
    }
    registerMany(inputs) {
        return inputs.map((entry) => this.register(entry));
    }
    async discover(source) {
        const resolved = await resolveDiscoverySource(source);
        if (isAsyncIterable(resolved)) {
            const discovered = [];
            for await (const entry of resolved)
                discovered.push(this.register(entry));
            return discovered;
        }
        if (Array.isArray(resolved))
            return this.registerMany(resolved);
        return [this.register(resolved)];
    }
    has(name, version) {
        if (version)
            return Boolean(this.entries.get(name)?.has(version));
        return Boolean(this.entries.get(name)?.size);
    }
    list() {
        return [...this.entries.values()].flatMap((versions) => [...versions.values()]);
    }
    listByName(name) {
        return [...(this.entries.get(name)?.values() ?? [])];
    }
    listByCapability(capability) {
        return this.list().filter((entry) => hasCapability(entry.capabilities, capability));
    }
    listByFeatureFlag(flag, enabled = true) {
        return this.list().filter((entry) => Boolean(entry.featureFlags[flag]) === enabled);
    }
    listByStatus(status) {
        return this.list().filter((entry) => entry.status === status);
    }
    listHealthy() {
        return this.list().filter((entry) => entry.health?.healthy ?? false);
    }
    resolve(name, version) {
        const entries = this.listByName(name);
        if (!entries.length)
            throw notFound(name);
        const selected = version ? entries.find((entry) => entry.version === version) : pickBestEntry(entries);
        if (!selected)
            throw notFound(`${name}@${version ?? "latest"}`);
        return selected;
    }
    resolveFallback(name, version) {
        const primary = this.resolve(name, version);
        if (primary.provider && primary.status !== ProviderStatus.DISABLED)
            return primary;
        if (primary.fallbackProvider && this.has(primary.fallbackProvider))
            return this.resolve(primary.fallbackProvider);
        const healthy = this.listHealthy().filter((entry) => entry.name !== name);
        const ranked = healthy.sort(compareEntries);
        if (ranked.length)
            return ranked[0];
        return primary;
    }
    async create(name, version) {
        const entry = this.resolve(name, version);
        const provider = entry.provider ?? (await this.factory.create({ entry, services: this.services }));
        if (provider !== entry.provider) {
            this.entries.get(entry.name)?.set(entry.version, Object.freeze({ ...entry, provider, updatedAt: new Date() }));
        }
        return provider;
    }
}
function pickBestEntry(entries) {
    const sorted = [...entries].sort(compareEntries);
    return sorted[0] ?? null;
}
function compareEntries(a, b) {
    if (a.status !== b.status) {
        if (a.status === ProviderStatus.READY)
            return -1;
        if (b.status === ProviderStatus.READY)
            return 1;
        if (a.status === ProviderStatus.DEGRADED)
            return -1;
        if (b.status === ProviderStatus.DEGRADED)
            return 1;
    }
    if (a.priority !== b.priority)
        return b.priority - a.priority;
    const versionComparison = compareVersions(a.version, b.version);
    if (versionComparison !== 0)
        return versionComparison;
    return a.updatedAt.getTime() - b.updatedAt.getTime();
}
function compareVersions(left, right) {
    const a = parseVersion(left);
    const b = parseVersion(right);
    for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
        const diff = (a[index] ?? 0) - (b[index] ?? 0);
        if (diff !== 0)
            return diff;
    }
    return 0;
}
function parseVersion(version) {
    return version
        .split(".")
        .map((part) => Number.parseInt(part.replace(/[^0-9].*$/, ""), 10))
        .map((value) => (Number.isFinite(value) ? value : 0));
}
function hasCapability(capabilities, capability) {
    if (capability === "operations")
        return capabilities.operations.length > 0;
    if (capability === "supportedStatuses")
        return capabilities.supportedStatuses.length > 0;
    if (capability === "rateLimit")
        return Boolean(capabilities.rateLimit);
    if (capability === "featureFlags")
        return Object.keys(capabilities.featureFlags).length > 0;
    if (capability in capabilities)
        return Boolean(capabilities[capability]);
    return capabilities.operations.includes(capability) || capabilities.supportedStatuses.some((status) => status === capability);
}
function notFound(identifier) {
    return new ProviderError({
        code: "NOT_FOUND",
        message: `Provider not found: ${identifier}`,
        provider: identifier,
        retryable: false,
    });
}
async function resolveDiscoverySource(source) {
    if (typeof source === "function")
        return resolveDiscoverySource(await source());
    return source instanceof Promise ? resolveDiscoverySource(await source) : source;
}
function isAsyncIterable(value) {
    return Boolean(value && typeof value === "object" && Symbol.asyncIterator in value);
}
