import type { DomainEventBase } from "./domainTypes";

export type SubmissionStarted = DomainEventBase<"SubmissionStarted", { releaseId: string }>;
export type SubmissionLocked = DomainEventBase<"SubmissionLocked", { releaseId: string; lockToken: string }>;
export type SnapshotCreated = DomainEventBase<"SnapshotCreated", { releaseId: string; snapshotId: string }>;
export type ValidationPassed = DomainEventBase<"ValidationPassed", { releaseId: string }>;
export type ValidationFailed = DomainEventBase<"ValidationFailed", { releaseId: string; reasons: readonly string[] }>;
export type ApprovalGranted = DomainEventBase<"ApprovalGranted", { releaseId: string }>;
export type ApprovalRejected = DomainEventBase<"ApprovalRejected", { releaseId: string; reason: string }>;
export type MetadataGenerated = DomainEventBase<"MetadataGenerated", { releaseId: string; snapshotId: string }>;
export type PackageBuilt = DomainEventBase<"PackageBuilt", { releaseId: string; packageFingerprint: string }>;
export type PackageVerified = DomainEventBase<"PackageVerified", { releaseId: string; packageFingerprint: string }>;
export type DistributionJobCreated = DomainEventBase<"DistributionJobCreated", { jobId: string; releaseId: string }>;
export type ProviderSelected = DomainEventBase<"ProviderSelected", { jobId: string; providerReference: string }>;
export type UploadStarted = DomainEventBase<"UploadStarted", { jobId: string; providerReference: string }>;
export type UploadCompleted = DomainEventBase<"UploadCompleted", { jobId: string; providerReceipt: string }>;
export type ProviderAccepted = DomainEventBase<"ProviderAccepted", { jobId: string; providerReceipt: string }>;
export type ProviderRejected = DomainEventBase<"ProviderRejected", { jobId: string; reason: string }>;
export type DSPAccepted = DomainEventBase<"DSPAccepted", { releaseId: string; providerReference: string }>;
export type DSPLive = DomainEventBase<"DSPLive", { releaseId: string; providerReference: string }>;
export type RoyaltyImported = DomainEventBase<"RoyaltyImported", { royaltyBatchId: string; releaseId: string }>;
export type RevenueCalculated = DomainEventBase<"RevenueCalculated", { royaltyBatchId: string; amount: number; currency: string }>;
export type PaymentProcessed = DomainEventBase<"PaymentProcessed", { paymentReference: string; royaltyBatchId: string }>;
export type StatementGenerated = DomainEventBase<"StatementGenerated", { paymentReference: string; statementReference: string }>;
export type ReleaseArchived = DomainEventBase<"ReleaseArchived", { releaseId: string }>;
export type ReleaseCancelled = DomainEventBase<"ReleaseCancelled", { releaseId: string; reason: string }>;
export type ReleaseTakenDown = DomainEventBase<"ReleaseTakenDown", { releaseId: string; reason: string }>;

export type DistributionDomainEvent =
  | SubmissionStarted
  | SubmissionLocked
  | SnapshotCreated
  | ValidationPassed
  | ValidationFailed
  | ApprovalGranted
  | ApprovalRejected
  | MetadataGenerated
  | PackageBuilt
  | PackageVerified
  | DistributionJobCreated
  | ProviderSelected
  | UploadStarted
  | UploadCompleted
  | ProviderAccepted
  | ProviderRejected
  | DSPAccepted
  | DSPLive
  | RoyaltyImported
  | RevenueCalculated
  | PaymentProcessed
  | StatementGenerated
  | ReleaseArchived
  | ReleaseCancelled
  | ReleaseTakenDown;

