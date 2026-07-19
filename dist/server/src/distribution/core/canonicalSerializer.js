function normalize(value) {
    if (value === null)
        return null;
    if (typeof value === "boolean" || typeof value === "number" || typeof value === "string") {
        return value;
    }
    if (value instanceof Date) {
        return value.toISOString();
    }
    if (Buffer.isBuffer(value)) {
        return value.toString("base64");
    }
    if (value instanceof Uint8Array) {
        return Buffer.from(value).toString("base64");
    }
    if (Array.isArray(value)) {
        return Object.freeze(value.map((entry) => normalize(entry)));
    }
    if (!value || typeof value !== "object") {
        return String(value);
    }
    const entries = Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, normalize(entry)]);
    return Object.freeze(Object.fromEntries(entries));
}
export function serializeCanonicalJSON(value) {
    return JSON.stringify(normalize(value));
}
export function canonicalizeJSON(value) {
    if (value == null || typeof value !== "object") {
        return value;
    }
    return JSON.parse(serializeCanonicalJSON(value));
}
