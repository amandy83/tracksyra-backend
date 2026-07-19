import type {
  AggregateRepository,
  AuditReference,
  DistributionDomainEvent,
  EventPublisher,
  Package,
  PaymentRecord,
  ProviderSubmissionAggregate,
  RoyaltyBatchAggregate,
  RoyaltyRecord,
  Release,
  ReleaseAggregate,
  ReleaseId,
  SnapshotId,
  SubmissionLock,
  TerritorySet,
} from "../domain";
import type { PackageFingerprint, ManifestChecksum, ProviderReference, ProviderStatus } from "../domain";
import type { DistributionJobAggregate } from "../domain";
import type { DistributionState } from "../domain";

export type ApplicationEventPublisher = EventPublisher<DistributionDomainEvent>;

export type ReleaseAggregateRepository = AggregateRepository<ReleaseAggregate, ReleaseId>;
export type DistributionJobAggregateRepository = AggregateRepository<DistributionJobAggregate, string>;
export type ProviderSubmissionAggregateRepository = AggregateRepository<ProviderSubmissionAggregate, string>;
export type RoyaltyBatchAggregateRepository = AggregateRepository<RoyaltyBatchAggregate, string>;

export type ReleaseReadModel = Readonly<{
  id: string;
  state: DistributionState;
  title: string;
  primaryArtist: string;
  version: string | null;
  submissionLock: SubmissionLock | null;
  snapshotId: SnapshotId | null;
  packageFingerprint: PackageFingerprint | null;
  manifestChecksum: ManifestChecksum | null;
  providerReference: ProviderReference | null;
  providerStatus: ProviderStatus | null;
  territories: TerritorySet;
  auditReference: AuditReference | null;
}>;

export type DistributionTimelineEntry = Readonly<{
  type: string;
  occurredAt: string;
  payload: Readonly<Record<string, unknown>>;
}>;

export type RoyaltySummary = Readonly<{
  releaseId: string;
  royaltyBatchId: string | null;
  amount: number;
  currency: string | null;
  recordCount: number;
}>;

export type PaymentStatusSummary = Readonly<{
  releaseId: string;
  paymentReference: string | null;
  status: string | null;
  amount: number;
  currency: string | null;
}>;

export type ProviderSubmissionSummary = Readonly<{
  releaseId: string;
  providerReference: string | null;
  providerReceipt: string | null;
  status: string | null;
}>;

export type DistributionPorts = Readonly<{
  events: ApplicationEventPublisher;
  releases: ReleaseAggregateRepository;
  jobs: DistributionJobAggregateRepository;
  providerSubmissions: ProviderSubmissionAggregateRepository;
  royaltyBatches: RoyaltyBatchAggregateRepository;
}>;

export type MetadataValidationPort = Readonly<{
  validateRelease(release: Release): Promise<{ valid: boolean; errors: readonly string[]; warnings: readonly string[] }> | { valid: boolean; errors: readonly string[]; warnings: readonly string[] };
}>;

export type AudioQcPort = Readonly<{
  validateRelease(release: Release): Promise<{ valid: boolean; errors: readonly string[] }> | { valid: boolean; errors: readonly string[] };
}>;

export type ArtworkQcPort = Readonly<{
  validateRelease(release: Release): Promise<{ valid: boolean; errors: readonly string[] }> | { valid: boolean; errors: readonly string[] };
}>;

export type RightsValidationPort = Readonly<{
  validateRelease(release: Release): Promise<{ valid: boolean; errors: readonly string[] }> | { valid: boolean; errors: readonly string[] };
}>;

export type IsrcManagementPort = Readonly<{
  validateRelease(release: Release): Promise<void> | void;
}>;

export type UpcManagementPort = Readonly<{
  validateRelease(release: Release): Promise<void> | void;
}>;

export type ApprovalWorkflowPort = Readonly<{
  requestApproval(release: Release): Promise<"approved" | "rejected"> | "approved" | "rejected";
}>;

export type MetadataEnginePort = Readonly<{
  buildRelease(release: Release): Promise<Release> | Release;
}>;

export type PackagingEnginePort = Readonly<{
  buildPackage(release: Release): Promise<Package> | Package;
  verifyPackage(packageModel: Package): Promise<{ manifestValid: boolean; checksumValid: boolean; fingerprintValid: boolean }> | { manifestValid: boolean; checksumValid: boolean; fingerprintValid: boolean };
}>;

export type ProviderFrameworkPort = Readonly<{
  resolveProvider(release: Release, packageModel: Package): Promise<ProviderReference> | ProviderReference;
  authenticate(providerReference: ProviderReference, release: Release): Promise<{ receipt: string; status: ProviderStatus }> | { receipt: string; status: ProviderStatus };
  submitPackage(providerReference: ProviderReference, packageModel: Package): Promise<{ receipt: string; status: ProviderStatus }> | { receipt: string; status: ProviderStatus };
  fetchStatus(providerReference: ProviderReference, release: Release): Promise<ProviderStatus> | ProviderStatus;
}>;

export type PaymentSystemPort = Readonly<{
  importRoyalties(release: Release): Promise<readonly RoyaltyRecord[]> | readonly RoyaltyRecord[];
  calculateRevenue(records: readonly RoyaltyRecord[]): Promise<{ amount: number; currency: string }> | { amount: number; currency: string };
  processPayments(release: Release, amount: number, currency: string): Promise<PaymentRecord> | PaymentRecord;
  generateStatement(payment: PaymentRecord): Promise<string> | string;
}>;

export type NotificationSystemPort = Readonly<{
  notify(eventType: string, payload: Readonly<Record<string, unknown>>): Promise<void> | void;
}>;

export type ArtistDashboardPort = Readonly<{
  projectRelease(releaseId: ReleaseId): Promise<void> | void;
}>;

export type DistributionQueryPort = Readonly<{
  loadRelease(releaseId: ReleaseId): Promise<ReleaseAggregate | null> | ReleaseAggregate | null;
  getReleaseView(releaseId: ReleaseId): Promise<ReleaseReadModel | null> | ReleaseReadModel | null;
  getTimeline(releaseId: ReleaseId): Promise<readonly DistributionTimelineEntry[]> | readonly DistributionTimelineEntry[];
  getProviderSubmission(releaseId: ReleaseId): Promise<ProviderSubmissionSummary | null> | ProviderSubmissionSummary | null;
  getRoyaltySummary(releaseId: ReleaseId): Promise<RoyaltySummary | null> | RoyaltySummary | null;
  getPaymentSummary(releaseId: ReleaseId): Promise<PaymentStatusSummary | null> | PaymentStatusSummary | null;
}>;
