import { deepFreeze } from "./packageUtils.js";
export class PackageResult {
    packageId;
    releaseId;
    version;
    fingerprint;
    checksum;
    outputPath;
    workspacePath;
    manifestPath;
    createdAt;
    files;
    metadata;
    constructor(input) {
        this.packageId = input.packageId;
        this.releaseId = input.releaseId;
        this.version = input.version;
        this.fingerprint = input.fingerprint;
        this.checksum = input.checksum;
        this.outputPath = input.outputPath;
        this.workspacePath = input.workspacePath;
        this.manifestPath = input.manifestPath;
        this.createdAt = new Date(input.createdAt);
        this.files = Object.freeze([...input.files]);
        this.metadata = deepFreeze({ ...(input.metadata ?? {}) });
        Object.freeze(this);
    }
    toJSON() {
        return deepFreeze({
            packageId: this.packageId,
            releaseId: this.releaseId,
            version: this.version,
            fingerprint: this.fingerprint,
            checksum: this.checksum,
            outputPath: this.outputPath,
            workspacePath: this.workspacePath,
            manifestPath: this.manifestPath,
            createdAt: this.createdAt.toISOString(),
            files: this.files,
            metadata: this.metadata,
        });
    }
}
