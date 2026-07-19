import type { PackageManifestDocument } from "../packaging";
import type { PackageResult } from "../packaging/packageResult";
import type { Package, PackageArtifact } from "../domain";
import type { UniversalRelease } from "../metadata";

export type DeliveryValidationSeverity = "error" | "warning";

export type DeliveryValidationIssue = Readonly<{
  code: string;
  category: string;
  message: string;
  severity: DeliveryValidationSeverity;
  target: string;
  value: unknown;
}>;

export type DeliveryValidationReport = Readonly<{
  valid: boolean;
  errors: readonly DeliveryValidationIssue[];
  warnings: readonly DeliveryValidationIssue[];
  metadata: Readonly<Record<string, unknown>>;
}>;

export type DeliveryCheckpointStage =
  | "VALIDATION"
  | "NORMALIZATION"
  | "MANIFEST"
  | "PACKAGE"
  | "SIGNED"
  | "VERIFIED"
  | "ARCHIVED"
  | "ROLLED_BACK"
  | "RECOVERED"
  | "FAILED";

export type DeliveryCheckpoint = Readonly<{
  checkpointId: string;
  releaseId: string;
  packageId: string;
  version: string;
  stage: DeliveryCheckpointStage;
  createdAt: string;
  resumedFromCheckpointId: string | null;
  metadata: Readonly<Record<string, unknown>>;
}>;

export type DeliveryAuditRecord = Readonly<{
  auditId: string;
  releaseId: string;
  packageId: string;
  version: string;
  action: string;
  status: "SUCCESS" | "FAILED" | "RECOVERED" | "ROLLED_BACK" | "UPDATED";
  createdAt: string;
  metadata: Readonly<Record<string, unknown>>;
}>;

export type DeliveryPackageArtifact = Readonly<{
  path: string;
  kind: string;
  checksum: string | null;
  sizeBytes: number | null;
  contentType: string | null;
  metadata: Readonly<Record<string, unknown>>;
}>;

export type DeliveryPackageSnapshot = Readonly<{
  id: string;
  version: string;
  packageId: string;
  releaseId: string;
  fingerprint: string;
  createdAt: string;
  serialized: string;
  manifest: PackageManifestDocument;
  metadata: Readonly<Record<string, unknown>>;
}>;

export type DeliveryPackageInput = Readonly<{
  packageId: string;
  releaseId: string;
  version: string;
  generatedAt: string;
  scheduledFor: string | null;
  normalizedRelease: UniversalRelease;
  packageModel: Package;
  packageResult: PackageResult;
  manifest: PackageManifestDocument;
  checksum: string;
  signature: Readonly<Record<string, unknown>> | null;
  artifacts: readonly DeliveryPackageArtifact[];
  validation: DeliveryValidationReport;
  checkpoint: DeliveryCheckpoint;
  resumedFromCheckpointId: string | null;
  rollbackOfPackageId: string | null;
  snapshot: DeliveryPackageSnapshot;
  auditTrail: readonly DeliveryAuditRecord[];
  metadata: Readonly<Record<string, unknown>>;
}>;

export class DeliveryPackage {
  readonly packageId: string;
  readonly releaseId: string;
  readonly version: string;
  readonly generatedAt: string;
  readonly scheduledFor: string | null;
  readonly normalizedRelease: UniversalRelease;
  readonly packageModel: Package;
  readonly packageResult: PackageResult;
  readonly manifest: PackageManifestDocument;
  readonly checksum: string;
  readonly signature: Readonly<Record<string, unknown>> | null;
  readonly artifacts: readonly DeliveryPackageArtifact[];
  readonly validation: DeliveryValidationReport;
  readonly checkpoint: DeliveryCheckpoint;
  readonly resumedFromCheckpointId: string | null;
  readonly rollbackOfPackageId: string | null;
  readonly snapshot: DeliveryPackageSnapshot;
  readonly auditTrail: readonly DeliveryAuditRecord[];
  readonly metadata: Readonly<Record<string, unknown>>;

  constructor(input: DeliveryPackageInput) {
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

  toPackage(): Package {
    return this.packageModel;
  }

  withAuditTrail(auditTrail: readonly DeliveryAuditRecord[]): DeliveryPackage {
    return new DeliveryPackage({
      ...this.toJSON(),
      auditTrail,
    });
  }

  toJSON(): DeliveryPackageInput {
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
