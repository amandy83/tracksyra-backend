import type { DistributionStatus } from "../core/distributionStatus";
import { DistributionStatus as CoreDistributionStatus } from "../core/distributionStatus";
import { ProviderStatus } from "./providerStatus";

export type ProviderStatusMapperConfig = Readonly<{
  customToProviderStatus?: Readonly<Partial<Record<string, ProviderStatus>>>;
  customToDistributionStatus?: Readonly<Partial<Record<string, DistributionStatus>>>;
}>;

export class ProviderStatusMapper {
  constructor(private readonly config: ProviderStatusMapperConfig = {}) {}

  normalize(value: string | null | undefined): string {
    return String(value ?? "").trim().toUpperCase();
  }

  toProviderStatus(value: string | null | undefined): ProviderStatus {
    const normalized = this.normalize(value);
    if (normalized && this.config.customToProviderStatus?.[normalized]) {
      return this.config.customToProviderStatus[normalized]!;
    }

    switch (normalized) {
      case "READY":
      case "ACTIVE":
        return ProviderStatus.READY;
      case "DEGRADED":
      case "WARNING":
        return ProviderStatus.DEGRADED;
      case "DISABLED":
      case "SUSPENDED":
        return ProviderStatus.DISABLED;
      case "AUTH_REQUIRED":
      case "UNAUTHORIZED":
      case "NEEDS_AUTHORIZATION":
        return ProviderStatus.AUTH_REQUIRED;
      case "CONFIGURATION_REQUIRED":
      case "NOT_CONFIGURED":
        return ProviderStatus.CONFIGURATION_REQUIRED;
      case "UNAVAILABLE":
      case "DOWN":
      case "OFFLINE":
        return ProviderStatus.UNAVAILABLE;
      case "ERROR":
      case "FAILED":
        return ProviderStatus.ERROR;
      default:
        return ProviderStatus.INITIALIZING;
    }
  }

  toDistributionStatus(value: string | null | undefined): DistributionStatus {
    const normalized = this.normalize(value);
    if (normalized && this.config.customToDistributionStatus?.[normalized]) {
      return this.config.customToDistributionStatus[normalized]!;
    }
    switch (normalized) {
      case "PROCESSING":
        return CoreDistributionStatus.PROCESSING;
      case "SUBMITTED":
        return CoreDistributionStatus.SUBMITTED;
      case "IN_REVIEW":
        return CoreDistributionStatus.IN_REVIEW;
      case "APPROVED":
        return CoreDistributionStatus.APPROVED;
      case "DELIVERED":
        return CoreDistributionStatus.DELIVERED;
      case "PUBLISHED":
      case "READY":
      case "ACTIVE":
        return CoreDistributionStatus.PUBLISHED;
      case "REJECTED":
      case "DISABLED":
      case "SUSPENDED":
        return CoreDistributionStatus.REJECTED;
      case "FAILED":
      case "ERROR":
        return CoreDistributionStatus.FAILED;
      case "DEAD_LETTER":
      case "UNAVAILABLE":
        return CoreDistributionStatus.DEAD_LETTER;
      default:
        return CoreDistributionStatus.PENDING;
    }
  }
}
