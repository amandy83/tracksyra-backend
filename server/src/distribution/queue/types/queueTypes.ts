export type QueueJobType =
  | "SubmissionJob"
  | "ValidationJob"
  | "ApprovalJob"
  | "MetadataJob"
  | "PackagingJob"
  | "VerificationJob"
  | "ProviderSelectionJob"
  | "UploadJob"
  | "ProviderProcessingJob"
  | "StatusSyncJob"
  | "DashboardProjectionJob"
  | "NotificationJob"
  | "RoyaltyJob"
  | "PaymentJob"
  | "ArchiveJob";

export type QueuePriorityLevel = "Critical" | "High" | "Normal" | "Low" | "Background";

export type QueueRetryPolicyName =
  | "Immediate"
  | "Linear"
  | "Exponential"
  | "ExponentialWithJitter"
  | "ManualOnly"
  | "NeverRetry";

export type QueueDeadLetterReason =
  | "RetryExceeded"
  | "FatalFailure"
  | "InvalidPayload"
  | "SerializationFailure"
  | "ManualReview";

export type QueueSchedulingPolicyName = "Immediate" | "Delayed" | "Scheduled" | "DependencyBased";

export type QueueRoutingPolicyName = "StageBased" | "PriorityBased" | "CapabilityBased" | "ProviderBased";

export type QueueLeasePolicyName = "Acquire" | "Renew" | "Release" | "Expire";

export type QueueBatchPolicyName = "Sequential" | "Parallel" | "Partitioned";

export type QueueMessageAttributes = Readonly<Record<string, string | number | boolean | null>>;

export type QueueMessageHeaders = Readonly<Record<string, string>>;

export type QueuePayload = Readonly<Record<string, unknown>>;

export type QueueTracing = Readonly<{
  traceId: string;
  correlationId: string;
  parentSpanId: string | null;
  spanId: string;
}>;

export interface QueueEntity {
  readonly createdAt: string;
}

