export enum DistributionStatus {
  PENDING = "PENDING",
  PROCESSING = "PROCESSING",
  SUBMITTED = "SUBMITTED",
  IN_REVIEW = "IN_REVIEW",
  APPROVED = "APPROVED",
  DELIVERED = "DELIVERED",
  PUBLISHED = "PUBLISHED",
  REJECTED = "REJECTED",
  FAILED = "FAILED",
  DEAD_LETTER = "DEAD_LETTER",
}

export const DISTRIBUTION_STATUS_VALUES = Object.freeze(Object.values(DistributionStatus));

export function isDistributionStatus(value: string): value is DistributionStatus {
  return DISTRIBUTION_STATUS_VALUES.includes(value as DistributionStatus);
}

