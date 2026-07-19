import type { DistributionStatus } from "../distributionStatus";

export type ProjectionEventType =
  | "ProjectionBuilt"
  | "ProjectionUpdated"
  | "ProjectionRebuilt"
  | "TimelineUpdated"
  | "DashboardUpdated"
  | "AnalyticsUpdated"
  | "AuditRecorded"
  | "SnapshotCreated";

export type TimelineStage =
  | "Submission"
  | "Validation"
  | "Approval"
  | "Packaging"
  | "Upload"
  | "DSP Processing"
  | "DSP Live"
  | "Royalty"
  | "Payment"
  | "Archive";

export type AnalyticsMetricName =
  | "submissionCounts"
  | "approvalRate"
  | "distributionSuccessRate"
  | "dspLatency"
  | "uploadLatency"
  | "failureRate"
  | "retryRate"
  | "royaltyTotals"
  | "paymentTotals";

export type SearchField = "releaseId" | "title" | "artist" | "state" | "providerReference" | "tag";

export type ProjectionMetadata = Readonly<Record<string, unknown>>;

export interface ProjectionEventPayload {
  readonly type: ProjectionEventType;
  readonly releaseId: string;
  readonly occurredAt: string;
  readonly payload: ProjectionMetadata;
}
