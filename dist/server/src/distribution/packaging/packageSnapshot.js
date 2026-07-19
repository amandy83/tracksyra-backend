import { deepFreeze } from "./packageUtils.js";
export class PackageSnapshot {
    id;
    version;
    packageId;
    releaseId;
    fingerprint;
    createdAt;
    serialized;
    manifest;
    metadata;
    constructor(input) {
        this.id = input.id;
        this.version = input.version;
        this.packageId = input.packageId;
        this.releaseId = input.releaseId;
        this.fingerprint = input.fingerprint;
        this.createdAt = new Date(input.createdAt);
        this.serialized = input.serialized;
        this.manifest = deepFreeze({ ...input.manifest });
        this.metadata = deepFreeze({ ...(input.metadata ?? {}) });
        Object.freeze(this);
    }
}
