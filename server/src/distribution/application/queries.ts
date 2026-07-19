import type { ReleaseId } from "../domain";

export type GetDistributionStatusQuery = Readonly<{ releaseId: ReleaseId }>;
export type GetTimelineQuery = Readonly<{ releaseId: ReleaseId }>;
export type GetProviderSubmissionQuery = Readonly<{ releaseId: ReleaseId }>;
export type GetRoyaltySummaryQuery = Readonly<{ releaseId: ReleaseId }>;
export type GetPaymentStatusQuery = Readonly<{ releaseId: ReleaseId }>;

