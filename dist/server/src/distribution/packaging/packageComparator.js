import { deepFreeze } from "./packageUtils.js";
export class PackageComparator {
    compare(before, after) {
        const beforeMap = new Map(before.files.map((file) => [file.path, file]));
        const afterMap = new Map(after.files.map((file) => [file.path, file]));
        const changes = new Map();
        for (const [path, file] of beforeMap) {
            const next = afterMap.get(path);
            if (!next) {
                changes.set(path, { path, before: file, after: null, changeType: "removed" });
                continue;
            }
            if (file.checksum !== next.checksum || file.size !== next.size || file.kind !== next.kind) {
                changes.set(path, { path, before: file, after: next, changeType: "changed" });
            }
        }
        for (const [path, file] of afterMap) {
            if (!beforeMap.has(path))
                changes.set(path, { path, before: null, after: file, changeType: "added" });
        }
        return deepFreeze({
            identical: changes.size === 0,
            changes: Object.freeze([...changes.values()].sort((left, right) => left.path.localeCompare(right.path))),
            beforeFingerprint: before.fingerprint,
            afterFingerprint: after.fingerprint,
            metadata: Object.freeze({}),
        });
    }
}
