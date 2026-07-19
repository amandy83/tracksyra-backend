import {
  DSPAccepted,
  DSPLive,
  DistributionJobCreated,
  MetadataGenerated,
  PackageBuilt,
  PackageVerified,
  PaymentProcessed,
  ProviderAccepted,
  ProviderRejected,
  ProviderSelected,
  ReleaseArchived,
  ReleaseCancelled,
  ReleaseTakenDown,
  RevenueCalculated,
  RoyaltyImported,
  SnapshotCreated,
  StatementGenerated,
  SubmissionLocked,
  SubmissionStarted,
  UploadCompleted,
  UploadStarted,
  ValidationFailed,
  ValidationPassed,
  type DistributionDomainEvent,
} from "../domain";
import { DistributionState, ProviderStatus, SubmissionLock, type ProviderStatus as ProviderStatusType } from "../domain";
import { DomainInvariantError } from "../domain";
import type { ReleaseAggregate } from "../domain";
import type { ApplicationEventPublisher } from "./applicationTypes";

export function createDomainEvent<T extends DistributionDomainEvent>(event: T): T {
  return event;
}

export function eventMeta(aggregateId: string, aggregateType: string, type: string, payload: Readonly<Record<string, unknown>>, version = 1) {
  return {
    type,
    aggregateId,
    aggregateType,
    occurredAt: new Date().toISOString(),
    version,
    payload,
  } as const;
}

export async function publishMany(publisher: ApplicationEventPublisher, events: readonly DistributionDomainEvent[]): Promise<void> {
  for (const event of events) {
    await Promise.resolve(publisher.publish(event));
  }
}

export function releaseIdValue(release: ReleaseAggregate): string {
  return release.release.id.value;
}

export function requireReleaseState(release: ReleaseAggregate, expected: readonly DistributionState[]): void {
  if (!expected.includes(release.release.state)) {
    throw new DomainInvariantError("Release is not in the expected state", {
      releaseId: release.release.id.value,
      currentState: release.release.state,
      expected,
    });
  }
}

export function mapProviderStatusToState(status: ProviderStatus): DistributionState {
  switch (status.value) {
    case "AUTHENTICATING":
      return "AUTHENTICATING_PROVIDER";
    case "UPLOADING":
      return "UPLOAD_IN_PROGRESS";
    case "PROCESSING":
      return "PROVIDER_PROCESSING";
    case "ACCEPTED":
      return "DSP_ACCEPTED";
    case "LIVE":
      return "DSP_LIVE";
    case "REJECTED":
      return "REJECTED";
    case "FAILED":
      return "REJECTED";
    case "CANCELLED":
      return "CANCELLED";
    case "TAKEDOWN_PENDING":
      return "TAKEDOWN_PENDING";
    case "TAKEDOWN_COMPLETED":
      return "TAKEDOWN_COMPLETED";
    case "PENDING":
    default:
      return "PROVIDER_PROCESSING";
  }
}

export function createSubmissionLock(releaseId: string, requestedBy: string, key: string): SubmissionLock {
  return new SubmissionLock({
    token: `${releaseId}:${key}`,
    owner: requestedBy,
  });
}
