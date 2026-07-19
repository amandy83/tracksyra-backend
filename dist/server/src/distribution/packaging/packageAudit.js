import { deepFreeze } from "./packageUtils.js";
export class PackageAudit {
    history = [];
    append(before, after, diff = null) {
        this.history.push(deepFreeze({
            id: after.id,
            packageId: after.packageId,
            releaseId: after.releaseId,
            snapshotId: after.id,
            fingerprint: after.fingerprint,
            createdAt: after.createdAt,
            diff,
            metadata: Object.freeze({ before: before?.id ?? null }),
        }));
        return this;
    }
    values() {
        return Object.freeze([...this.history]);
    }
}
