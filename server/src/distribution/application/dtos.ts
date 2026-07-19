import type { DistributionState, ManifestChecksum, PackageFingerprint, ProviderReference, ProviderStatus, ReleaseId, SnapshotId, SubmissionLock, TerritorySet } from "../domain";

export type SubmitReleaseRequest = Readonly<{
  releaseId: ReleaseId;
  requestedBy: string;
  idempotencyKey: string;
}>;

export type SubmitReleaseResponse = Readonly<{
  releaseId: ReleaseId;
  state: DistributionState;
  submissionLock: SubmissionLock | null;
  snapshotId: SnapshotId | null;
}>;

export type DistributionStatusResponse = Readonly<{
  releaseId: ReleaseId;
  state: DistributionState;
  packageFingerprint: PackageFingerprint | null;
  manifestChecksum: ManifestChecksum | null;
  providerReference: ProviderReference | null;
  providerStatus: ProviderStatus | null;
  territories: TerritorySet;
}>;

export type TimelineResponse = Readonly<{
  releaseId: ReleaseId;
  events: readonly { type: string; occurredAt: string; payload: Readonly<Record<string, unknown>> }[];
}>;

export type ProviderSubmissionResponse = Readonly<{
  releaseId: ReleaseId;
  providerReference: ProviderReference | null;
  providerReceipt: string | null;
  status: ProviderStatus | null;
}>;

export type RoyaltyResponse = Readonly<{
  releaseId: ReleaseId;
  royaltyBatchId: string | null;
  amount: number;
  currency: string | null;
  recordCount: number;
}>;

export type PaymentResponse = Readonly<{
  releaseId: ReleaseId;
  paymentReference: string | null;
  status: string | null;
  amount: number;
  currency: string | null;
}>;

