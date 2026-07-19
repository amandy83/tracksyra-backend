import { CURRENT_PACKAGE_VERSION } from "./packageVersion.js";
import { deepFreeze } from "./packageUtils.js";
export class PackageConfiguration {
    version;
    compression;
    encryption;
    workspaceRoot;
    outputRoot;
    cleanupTemporaryWorkspace;
    resumeInterrupted;
    concurrentAssets;
    maxFileSizeBytes;
    signed;
    metadata;
    constructor(input = {}) {
        this.version = input.version ?? CURRENT_PACKAGE_VERSION;
        this.compression = input.compression ?? "store";
        this.encryption = input.encryption ?? "none";
        this.workspaceRoot = input.workspaceRoot ?? null;
        this.outputRoot = input.outputRoot ?? null;
        this.cleanupTemporaryWorkspace = input.cleanupTemporaryWorkspace ?? true;
        this.resumeInterrupted = input.resumeInterrupted ?? true;
        this.concurrentAssets = Math.max(1, Math.trunc(input.concurrentAssets ?? 4));
        this.maxFileSizeBytes = Math.max(1, Math.trunc(input.maxFileSizeBytes ?? 10 * 1024 * 1024 * 1024));
        this.signed = input.signed ?? false;
        this.metadata = deepFreeze({ ...(input.metadata ?? {}) });
        Object.freeze(this);
    }
}
