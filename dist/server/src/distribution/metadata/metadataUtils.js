export function isPlainObject(value) {
    return Boolean(value && typeof value === "object" && !Array.isArray(value) && !(value instanceof Date) && !(value instanceof Uint8Array) && !Buffer.isBuffer(value));
}
export function deepFreeze(value) {
    if (Array.isArray(value)) {
        for (const entry of value)
            deepFreeze(entry);
        return Object.freeze(value);
    }
    if (value && typeof value === "object") {
        for (const entry of Object.values(value))
            deepFreeze(entry);
        return Object.freeze(value);
    }
    return value;
}
export function stableSerialize(value) {
    return JSON.stringify(normalizeForSerialization(value));
}
export function normalizeForSerialization(value) {
    if (value instanceof Date)
        return value.toISOString();
    if (value instanceof Uint8Array)
        return Buffer.from(value).toString("base64");
    if (Buffer.isBuffer(value))
        return value.toString("base64");
    if (Array.isArray(value))
        return value.map((entry) => normalizeForSerialization(entry));
    if (!isPlainObject(value))
        return value;
    return Object.fromEntries(Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, normalizeForSerialization(entry)]));
}
export function clonePlainObject(value) {
    return JSON.parse(stableSerialize(value));
}
