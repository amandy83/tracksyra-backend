export class PackagePolicy {
    allowCompression;
    allowEncryption;
    requireIntegrityChecks;
    requireSignatures;
    allowResume;
    cleanupTemporaryWorkspace;
    metadata;
    constructor(allowCompression = true, allowEncryption = false, requireIntegrityChecks = true, requireSignatures = false, allowResume = true, cleanupTemporaryWorkspace = true, metadata = {}) {
        this.allowCompression = allowCompression;
        this.allowEncryption = allowEncryption;
        this.requireIntegrityChecks = requireIntegrityChecks;
        this.requireSignatures = requireSignatures;
        this.allowResume = allowResume;
        this.cleanupTemporaryWorkspace = cleanupTemporaryWorkspace;
        this.metadata = metadata;
        Object.freeze(this);
    }
}
