import { deepFreeze } from "./packageUtils.js";
export class PackageContext {
    packageId;
    release;
    outputPath;
    workspacePath;
    version;
    compression;
    encryption;
    signed;
    metadata;
    artifacts;
    configuration;
    constructor(input) {
        this.packageId = input.packageId;
        this.release = input.release;
        this.outputPath = input.outputPath;
        this.workspacePath = input.workspacePath;
        this.version = input.version;
        this.compression = input.compression ?? "store";
        this.encryption = input.encryption ?? "none";
        this.signed = input.signed ?? false;
        this.metadata = deepFreeze({ ...(input.metadata ?? {}) });
        this.artifacts = Object.freeze([...(input.artifacts ?? [])]);
        this.configuration = input.configuration;
        Object.freeze(this);
    }
}
