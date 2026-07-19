export class DeliveryPackage {
    packageId;
    releaseId;
    version;
    generatedAt;
    scheduledFor;
    normalizedRelease;
    packageModel;
    packageResult;
    manifest;
    checksum;
    signature;
    artifacts;
    validation;
    checkpoint;
    resumedFromCheckpointId;
    rollbackOfPackageId;
    snapshot;
    auditTrail;
    metadata;
    constructor(input) {
        this.packageId = input.packageId.trim();
        this.releaseId = input.releaseId.trim();
        this.version = input.version.trim();
        this.generatedAt = input.generatedAt;
        this.scheduledFor = input.scheduledFor;
        this.normalizedRelease = input.normalizedRelease;
        this.packageModel = input.packageModel;
        this.packageResult = input.packageResult;
        this.manifest = input.manifest;
        this.checksum = input.checksum;
        this.signature = input.signature;
        this.artifacts = Object.freeze([...(input.artifacts ?? [])]);
        this.validation = input.validation;
        this.checkpoint = input.checkpoint;
        this.resumedFromCheckpointId = input.resumedFromCheckpointId;
        this.rollbackOfPackageId = input.rollbackOfPackageId;
        this.snapshot = input.snapshot;
        this.auditTrail = Object.freeze([...(input.auditTrail ?? [])]);
        this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
        if (!this.packageId || !this.releaseId || !this.version) {
            throw new Error("DeliveryPackage requires non-empty identifiers");
        }
        Object.freeze(this);
    }
    toPackage() {
        return this.packageModel;
    }
    withAuditTrail(auditTrail) {
        return new DeliveryPackage({
            ...this.toJSON(),
            auditTrail,
        });
    }
    toJSON() {
        return {
            packageId: this.packageId,
            releaseId: this.releaseId,
            version: this.version,
            generatedAt: this.generatedAt,
            scheduledFor: this.scheduledFor,
            normalizedRelease: this.normalizedRelease,
            packageModel: this.packageModel,
            packageResult: this.packageResult,
            manifest: this.manifest,
            checksum: this.checksum,
            signature: this.signature,
            artifacts: this.artifacts,
            validation: this.validation,
            checkpoint: this.checkpoint,
            resumedFromCheckpointId: this.resumedFromCheckpointId,
            rollbackOfPackageId: this.rollbackOfPackageId,
            snapshot: this.snapshot,
            auditTrail: this.auditTrail,
            metadata: this.metadata,
        };
    }
}
