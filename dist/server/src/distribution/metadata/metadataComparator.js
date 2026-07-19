import { normalizeForSerialization } from "./metadataUtils.js";
export class MetadataComparator {
    hasher;
    constructor(hasher) {
        this.hasher = hasher;
    }
    compare(before, after) {
        const changes = diffValues(normalizeForSerialization(before), normalizeForSerialization(after));
        return Object.freeze({
            identical: changes.length === 0,
            changes: Object.freeze(changes),
            beforeFingerprint: this.hasher.hash(before),
            afterFingerprint: this.hasher.hash(after),
            metadata: Object.freeze({ beforeVersion: before.version, afterVersion: after.version }),
        });
    }
}
function diffValues(before, after, path = "") {
    if (isEqual(before, after))
        return [];
    if (Array.isArray(before) || Array.isArray(after)) {
        const left = Array.isArray(before) ? before : [];
        const right = Array.isArray(after) ? after : [];
        const changes = [];
        const max = Math.max(left.length, right.length);
        for (let index = 0; index < max; index += 1) {
            const nextPath = `${path}[${index}]`;
            if (index >= left.length) {
                changes.push({ path: nextPath, before: undefined, after: right[index], changeType: "added" });
                continue;
            }
            if (index >= right.length) {
                changes.push({ path: nextPath, before: left[index], after: undefined, changeType: "removed" });
                continue;
            }
            changes.push(...diffValues(left[index], right[index], nextPath));
        }
        return changes;
    }
    if (isObject(before) && isObject(after)) {
        const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
        const changes = [];
        for (const key of [...keys].sort()) {
            const nextPath = path ? `${path}.${key}` : key;
            if (!(key in before)) {
                changes.push({ path: nextPath, before: undefined, after: after[key], changeType: "added" });
                continue;
            }
            if (!(key in after)) {
                changes.push({ path: nextPath, before: before[key], after: undefined, changeType: "removed" });
                continue;
            }
            changes.push(...diffValues(before[key], after[key], nextPath));
        }
        return changes;
    }
    return [{
            path,
            before,
            after,
            changeType: before === undefined ? "added" : after === undefined ? "removed" : "changed",
        }];
}
function isEqual(before, after) {
    return JSON.stringify(before) === JSON.stringify(after);
}
function isObject(value) {
    return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
