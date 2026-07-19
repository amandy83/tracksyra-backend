import { ProviderError } from "./providerError.js";
import { ProviderStatus } from "./providerStatus.js";
export class ProviderResolver {
    registry;
    constructor(registry) {
        this.registry = registry;
    }
    resolve(criteria = {}) {
        const candidates = this.registry.list();
        const filtered = candidates.filter((entry) => matchesCriteria(entry, criteria));
        if (filtered.length)
            return filtered.sort(compareCandidates)[0];
        if (criteria.allowFallback && criteria.name) {
            try {
                return this.registry.resolveFallback(criteria.name, criteria.version ?? undefined);
            }
            catch (error) {
                throw ProviderError.fromUnknown(error, criteria.name, criteria.version ?? null, { code: "NOT_FOUND" });
            }
        }
        throw new ProviderError({
            code: "NOT_FOUND",
            message: `No provider matches the requested criteria${criteria.name ? ` for ${criteria.name}` : ""}`,
            provider: criteria.name ?? "unknown",
            version: criteria.version ?? null,
            retryable: false,
        });
    }
}
function matchesCriteria(entry, criteria) {
    if (criteria.name && entry.name !== criteria.name)
        return false;
    if (criteria.version && entry.version !== criteria.version)
        return false;
    if (criteria.requireHealthy && !(entry.health?.healthy ?? false))
        return false;
    if (criteria.requireEnabled && entry.status === ProviderStatus.DISABLED)
        return false;
    if (criteria.operation && !entry.capabilities.operations.includes(criteria.operation))
        return false;
    if (criteria.featureFlags) {
        for (const [flag, enabled] of Object.entries(criteria.featureFlags)) {
            if (Boolean(entry.featureFlags[flag]) !== enabled)
                return false;
        }
    }
    if (criteria.capabilities) {
        for (const [key, value] of Object.entries(criteria.capabilities)) {
            if (value == null)
                continue;
            const current = entry.capabilities[key];
            if (Array.isArray(value) && Array.isArray(current)) {
                const valueStrings = value.map(String);
                const currentStrings = current.map(String);
                if (!valueStrings.every((item) => currentStrings.includes(item)))
                    return false;
                continue;
            }
            if (typeof value === "object" && typeof current === "object" && current)
                continue;
            if (current !== value)
                return false;
        }
    }
    return true;
}
function compareCandidates(a, b) {
    if (a.health?.healthy !== b.health?.healthy)
        return Number(b.health?.healthy ?? false) - Number(a.health?.healthy ?? false);
    if (a.priority !== b.priority)
        return b.priority - a.priority;
    if (a.status !== b.status) {
        if (a.status === ProviderStatus.READY)
            return -1;
        if (b.status === ProviderStatus.READY)
            return 1;
    }
    return compareVersions(b.version, a.version);
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
