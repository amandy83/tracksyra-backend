export function mergeProviderFeatureFlags(...flags) {
    const merged = {};
    for (const flagSet of flags) {
        if (!flagSet)
            continue;
        for (const [key, value] of Object.entries(flagSet))
            merged[key] = Boolean(value);
    }
    return Object.freeze(merged);
}
