import { createHash } from "node:crypto";
const CRC32_TABLE = (() => {
    const table = new Uint32Array(256);
    for (let i = 0; i < 256; i += 1) {
        let crc = i;
        for (let j = 0; j < 8; j += 1) {
            crc = (crc & 1) !== 0 ? 0xEDB88320 ^ (crc >>> 1) : crc >>> 1;
        }
        table[i] = crc >>> 0;
    }
    return table;
})();
export function deepFreeze(value) {
    if (!value || typeof value !== "object" || Object.isFrozen(value))
        return value;
    Object.freeze(value);
    for (const key of Object.keys(value)) {
        const child = value[key];
        if (child && typeof child === "object")
            deepFreeze(child);
    }
    return value;
}
export function stableStringify(value) {
    return JSON.stringify(value, (_key, current) => {
        if (current && typeof current === "object" && !Array.isArray(current)) {
            return Object.keys(current)
                .sort()
                .reduce((accumulator, key) => {
                accumulator[key] = current[key];
                return accumulator;
            }, {});
        }
        return current;
    });
}
export function sha256Hex(input) {
    return createHash("sha256").update(input).digest("hex");
}
export function bytesToHex(buffer) {
    return buffer.toString("hex");
}
export function crc32Update(crc, chunk) {
    let result = crc ^ 0xffffffff;
    for (const byte of chunk) {
        result = CRC32_TABLE[(result ^ byte) & 0xff] ^ (result >>> 8);
    }
    return (result ^ 0xffffffff) >>> 0;
}
export function normalizeArchivePath(path) {
    return path.replace(/\\/g, "/").replace(/^\/+/, "").replace(/\/{2,}/g, "/");
}
export function joinArchivePath(...segments) {
    return normalizeArchivePath(segments.filter(Boolean).join("/"));
}
export function toJsonText(value) {
    return `${stableStringify(value)}\n`;
}
