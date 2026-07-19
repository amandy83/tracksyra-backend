import type { ReleaseId } from "../domain";

export type SubmitReleaseCommand = Readonly<{ releaseId: ReleaseId; requestedBy: string; idempotencyKey: string }>;
export type ValidateReleaseCommand = Readonly<{ releaseId: ReleaseId; requestedBy: string }>;
export type ApproveReleaseCommand = Readonly<{ releaseId: ReleaseId; approvedBy: string }>;
export type BuildPackageCommand = Readonly<{ releaseId: ReleaseId; requestedBy: string }>;
export type SubmitPackageCommand = Readonly<{ releaseId: ReleaseId; providerHint?: string | null; requestedBy: string }>;
export type SyncStatusCommand = Readonly<{ releaseId: ReleaseId; requestedBy: string }>;
export type ImportRoyaltyCommand = Readonly<{ releaseId: ReleaseId; requestedBy: string }>;
export type ProcessPaymentCommand = Readonly<{ releaseId: ReleaseId; requestedBy: string }>;
export type ArchiveReleaseCommand = Readonly<{ releaseId: ReleaseId; requestedBy: string }>;

