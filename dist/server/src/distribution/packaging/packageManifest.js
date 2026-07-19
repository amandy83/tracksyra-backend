import { deepFreeze } from "./packageUtils.js";
export class PackageManifest {
    version;
    packageId;
    releaseId;
    fingerprint;
    createdAt;
    files;
    metadata;
    constructor(input) {
        this.version = input.version;
        this.packageId = input.packageId;
        this.releaseId = input.releaseId;
        this.fingerprint = input.fingerprint;
        this.createdAt = new Date(input.createdAt);
        this.files = Object.freeze([...input.files]);
        this.metadata = deepFreeze({ ...(input.metadata ?? {}) });
        Object.freeze(this);
    }
    static create(input) {
        return new PackageManifest({
            ...input,
            createdAt: input.createdAt ?? new Date().toISOString(),
        });
    }
    toJSON() {
        return deepFreeze({
            version: this.version,
            packageId: this.packageId,
            releaseId: this.releaseId,
            fingerprint: this.fingerprint,
            createdAt: this.createdAt.toISOString(),
            files: this.files,
            metadata: this.metadata,
        });
    }
    withFiles(files) {
        return new PackageManifest({
            ...this.toJSON(),
            files,
        });
    }
}
