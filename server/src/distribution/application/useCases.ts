import {
  ApprovalGranted,
  ApprovalRejected,
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
  DomainInvariantError,
  DistributionJobId,
  DistributionStateMachine,
  ManifestChecksum,
  PackageFingerprint,
  PaymentReference,
  ProviderReceipt,
  ProviderReference,
  ProviderStatus,
  Release,
  ReleaseAggregate,
  ReleaseId,
  RoyaltyBatchId,
  SnapshotId,
  SubmissionLock,
  ProviderSubmissionAggregate,
  RoyaltyBatchAggregate,
  DistributionJobAggregate,
  Package,
  RoyaltyRecord,
  PaymentRecord,
  type DistributionDomainEvent,
  type DistributionState,
} from "../domain";
import { nowIso } from "../domain";
import type { Package as DistributionPackage } from "../domain";
import type {
  ApproveReleaseCommand,
  ArchiveReleaseCommand,
  BuildPackageCommand,
  ImportRoyaltyCommand,
  ProcessPaymentCommand,
  SubmitPackageCommand,
  SubmitReleaseCommand,
  SyncStatusCommand,
  ValidateReleaseCommand,
} from "./commands";
import type {
  DistributionStatusResponse,
  PaymentResponse,
  ProviderSubmissionResponse,
  RoyaltyResponse,
  SubmitReleaseResponse,
} from "./dtos";
import type { DistributionApplicationDependencies } from "./dependencyTypes";
import { createSubmissionLock, eventMeta, mapProviderStatusToState, publishMany, releaseIdValue, requireReleaseState } from "./helpers";

type ValidateResult = Readonly<{ valid: boolean; errors: readonly string[]; warnings: readonly string[] }>;

async function resolve<T>(value: Promise<T> | T): Promise<T> {
  return await Promise.resolve(value);
}

async function loadRelease(deps: DistributionApplicationDependencies, releaseId: ReleaseId): Promise<ReleaseAggregate> {
  const aggregate = await resolve(deps.releases.findById(releaseId));
  if (!aggregate) {
    throw new DomainInvariantError("Release aggregate not found", { releaseId: releaseId.value });
  }
  return aggregate;
}

async function loadProviderSubmission(deps: DistributionApplicationDependencies, releaseId: ReleaseId): Promise<ProviderSubmissionAggregate> {
  const aggregate = await resolve(deps.providerSubmissions.findById(releaseId.value));
  if (!aggregate) {
    throw new DomainInvariantError("Provider submission aggregate not found", { releaseId: releaseId.value });
  }
  return aggregate;
}

async function loadRoyaltyBatch(deps: DistributionApplicationDependencies, releaseId: ReleaseId): Promise<RoyaltyBatchAggregate> {
  const aggregate = await resolve(deps.royaltyBatches.findById(releaseId.value));
  if (!aggregate) {
    throw new DomainInvariantError("Royalty batch aggregate not found", { releaseId: releaseId.value });
  }
  return aggregate;
}

async function saveRelease(deps: DistributionApplicationDependencies, aggregate: ReleaseAggregate): Promise<void> {
  await resolve(deps.releases.save(aggregate));
}

async function saveProviderSubmission(deps: DistributionApplicationDependencies, aggregate: ProviderSubmissionAggregate): Promise<void> {
  await resolve(deps.providerSubmissions.save(aggregate));
}

async function saveRoyaltyBatch(deps: DistributionApplicationDependencies, aggregate: RoyaltyBatchAggregate): Promise<void> {
  await resolve(deps.royaltyBatches.save(aggregate));
}

function releaseEvent(aggregate: ReleaseAggregate, type: string, payload: Readonly<Record<string, unknown>>): DistributionDomainEvent {
  return {
    type,
    aggregateId: aggregate.release.id.value,
    aggregateType: "ReleaseAggregate",
    occurredAt: nowIso(),
    version: 1,
    payload,
  } as DistributionDomainEvent;
}

function jobEvent(aggregate: DistributionJobAggregate, type: string, payload: Readonly<Record<string, unknown>>): DistributionDomainEvent {
  return {
    type,
    aggregateId: aggregate.id.value,
    aggregateType: "DistributionJobAggregate",
    occurredAt: nowIso(),
    version: 1,
    payload,
  } as DistributionDomainEvent;
}

function providerEvent(aggregate: ProviderSubmissionAggregate, type: string, payload: Readonly<Record<string, unknown>>): DistributionDomainEvent {
  return {
    type,
    aggregateId: aggregate.releaseId.value,
    aggregateType: "ProviderSubmissionAggregate",
    occurredAt: nowIso(),
    version: 1,
    payload,
  } as DistributionDomainEvent;
}

function royaltyEvent(aggregate: RoyaltyBatchAggregate, type: string, payload: Readonly<Record<string, unknown>>): DistributionDomainEvent {
  return {
    type,
    aggregateId: aggregate.id.value,
    aggregateType: "RoyaltyBatchAggregate",
    occurredAt: nowIso(),
    version: 1,
    payload,
  } as DistributionDomainEvent;
}

function cloneRelease(release: Release, patch: Partial<{
  state: DistributionState;
  packageFingerprint: PackageFingerprint | null;
  manifestChecksum: ManifestChecksum | null;
  submissionLock: SubmissionLock | null;
  snapshotId: SnapshotId | null;
  auditReference: import("../domain").AuditReference | null;
}> = {}): Release {
  return new Release({
    id: release.id,
    title: release.title,
    primaryArtist: release.primaryArtist,
    version: release.version,
    state: patch.state ?? release.state,
    contributors: release.contributors,
    tracks: release.tracks,
    label: release.label,
    upc: release.upc,
    releaseDate: release.releaseDate,
    originalReleaseDate: release.originalReleaseDate,
    territories: release.territories,
    packageFingerprint: patch.packageFingerprint ?? release.packageFingerprint,
    manifestChecksum: patch.manifestChecksum ?? release.manifestChecksum,
    submissionLock: patch.submissionLock ?? release.submissionLock,
    snapshotId: patch.snapshotId ?? release.snapshotId,
    distributionVersion: release.distributionVersion,
    auditReference: patch.auditReference ?? release.auditReference,
    metadata: release.metadata,
  });
}

export class SubmitReleaseForDistribution {
  constructor(private readonly deps: DistributionApplicationDependencies) {}

  async execute(command: SubmitReleaseCommand): Promise<SubmitReleaseResponse> {
    const current = await loadRelease(this.deps, command.releaseId);
    const lock = createSubmissionLock(command.releaseId.value, command.requestedBy, command.idempotencyKey);
    let next = current.lockSubmission(lock);
    next = next.createSnapshot(new SnapshotId(`${command.releaseId.value}:${command.idempotencyKey}`));
    next = next.transition("VALIDATION_PENDING");
    await saveRelease(this.deps, next);
    await publishMany(this.deps.events, [
      releaseEvent(next, "SubmissionStarted", { releaseId: command.releaseId.value, requestedBy: command.requestedBy }),
      releaseEvent(next, "SubmissionLocked", { releaseId: command.releaseId.value, lockToken: lock.token }),
      releaseEvent(next, "SnapshotCreated", { releaseId: command.releaseId.value, snapshotId: next.release.snapshotId?.value ?? null }),
    ] as const);
    await resolve(this.deps.notificationSystem.notify("submission_started", { releaseId: command.releaseId.value, requestedBy: command.requestedBy }));
    await resolve(this.deps.artistDashboard.projectRelease(command.releaseId));
    return {
      releaseId: command.releaseId,
      state: next.release.state,
      submissionLock: lock,
      snapshotId: next.release.snapshotId,
    };
  }
}

export class ValidateRelease {
  constructor(private readonly deps: DistributionApplicationDependencies) {}

  async execute(command: ValidateReleaseCommand): Promise<ValidateResult> {
    const current = await loadRelease(this.deps, command.releaseId);
    requireReleaseState(current, ["VALIDATION_PENDING"]);
    const release = current.release;
    const metadata = await resolve(this.deps.metadataValidation.validateRelease(release));
    const audio = await resolve(this.deps.audioQc.validateRelease(release));
    const artwork = await resolve(this.deps.artworkQc.validateRelease(release));
    const rights = await resolve(this.deps.rightsValidation.validateRelease(release));
    await resolve(this.deps.isrcManagement.validateRelease(release));
    await resolve(this.deps.upcManagement.validateRelease(release));
    const valid = metadata.valid && audio.valid && artwork.valid && rights.valid;
    const errors = [...metadata.errors, ...audio.errors, ...artwork.errors, ...rights.errors];
    let next = current;
    if (valid) {
      next = current.transition("VALIDATED");
      await publishMany(this.deps.events, [releaseEvent(next, "ValidationPassed", { releaseId: command.releaseId.value })]);
    } else {
      next = current.transition("REJECTED");
      await publishMany(this.deps.events, [releaseEvent(next, "ValidationFailed", { releaseId: command.releaseId.value, reasons: errors })]);
    }
    await saveRelease(this.deps, next);
    return { valid, errors, warnings: metadata.warnings };
  }
}

export class ApproveRelease {
  constructor(private readonly deps: DistributionApplicationDependencies) {}

  async execute(command: ApproveReleaseCommand): Promise<void> {
    const current = await loadRelease(this.deps, command.releaseId);
    requireReleaseState(current, ["VALIDATED"]);
    let pending = current.transition("APPROVAL_PENDING");
    await saveRelease(this.deps, pending);
    const decision = await resolve(this.deps.approvalWorkflow.requestApproval(pending.release));
    if (decision === "approved") {
      pending = pending.transition("APPROVED");
      await publishMany(this.deps.events, [releaseEvent(pending, "ApprovalGranted", { releaseId: command.releaseId.value, approvedBy: command.approvedBy })]);
    } else {
      pending = pending.transition("REJECTED");
      await publishMany(this.deps.events, [releaseEvent(pending, "ApprovalRejected", { releaseId: command.releaseId.value, approvedBy: command.approvedBy })]);
    }
    await saveRelease(this.deps, pending);
  }
}

export class BuildUniversalMetadata {
  constructor(private readonly deps: DistributionApplicationDependencies) {}

  async execute(command: BuildPackageCommand): Promise<void> {
    const current = await loadRelease(this.deps, command.releaseId);
    requireReleaseState(current, ["APPROVED"]);
    const built = await resolve(this.deps.metadataEngine.buildRelease(current.release));
    const next = new ReleaseAggregate({ release: cloneRelease(built, { state: "METADATA_GENERATED" }) });
    await saveRelease(this.deps, next);
    await publishMany(this.deps.events, [releaseEvent(next, "MetadataGenerated", { releaseId: command.releaseId.value })]);
    await resolve(this.deps.notificationSystem.notify("metadata_generated", { releaseId: command.releaseId.value }));
  }
}

export class BuildDistributionPackage {
  constructor(private readonly deps: DistributionApplicationDependencies) {}

  async execute(command: BuildPackageCommand): Promise<DistributionPackage> {
    const current = await loadRelease(this.deps, command.releaseId);
    requireReleaseState(current, ["METADATA_GENERATED"]);
    const packageModel = await resolve(this.deps.packagingEngine.buildPackage(current.release));
    const next = new ReleaseAggregate({
      release: cloneRelease(current.release, {
        state: "PACKAGE_BUILT",
        packageFingerprint: packageModel.fingerprint,
        manifestChecksum: packageModel.manifestChecksum,
      }),
      packageModel,
    });
    await saveRelease(this.deps, next);
    await publishMany(this.deps.events, [releaseEvent(next, "PackageBuilt", { releaseId: command.releaseId.value, fingerprint: packageModel.fingerprint.value })]);
    return packageModel;
  }
}

export class VerifyDistributionPackage {
  constructor(private readonly deps: DistributionApplicationDependencies) {}

  async execute(command: BuildPackageCommand): Promise<void> {
    const current = await loadRelease(this.deps, command.releaseId);
    requireReleaseState(current, ["PACKAGE_BUILT"]);
    if (!current.packageModel) {
      throw new DomainInvariantError("Package model is required for verification", { releaseId: command.releaseId.value });
    }
    const result = await resolve(this.deps.packagingEngine.verifyPackage(current.packageModel));
    if (!(result.manifestValid && result.checksumValid && result.fingerprintValid)) {
      throw new DomainInvariantError("Package verification failed", { releaseId: command.releaseId.value, result });
    }
    const next = current.transition("PACKAGE_VERIFIED");
    await saveRelease(this.deps, next);
    await publishMany(this.deps.events, [releaseEvent(next, "PackageVerified", { releaseId: command.releaseId.value, fingerprint: next.release.packageFingerprint?.value ?? null })]);
  }
}

export class SelectProvider {
  constructor(private readonly deps: DistributionApplicationDependencies) {}

  async execute(command: SubmitPackageCommand): Promise<ProviderReference> {
    const current = await loadRelease(this.deps, command.releaseId);
    requireReleaseState(current, ["PACKAGE_VERIFIED"]);
    if (!current.packageModel) {
      throw new DomainInvariantError("Package model is required for provider selection", { releaseId: command.releaseId.value });
    }
    const job = new DistributionJobAggregate({
      id: new DistributionJobId(`${command.releaseId.value}:job`),
      releaseId: command.releaseId,
    });
    await resolve(this.deps.jobs.save(job));
    const providerReference = await resolve(this.deps.providerFramework.resolveProvider(current.release, current.packageModel));
    const submission = new ProviderSubmissionAggregate({
      providerReference,
      releaseId: command.releaseId,
      jobId: job.id,
    });
    const next = current.transition("DISTRIBUTION_JOB_CREATED").transition("PROVIDER_SELECTED");
    await saveRelease(this.deps, next);
    await saveProviderSubmission(this.deps, submission);
    await publishMany(this.deps.events, [
      releaseEvent(next, "DistributionJobCreated", { releaseId: command.releaseId.value, jobId: job.id.value }),
      releaseEvent(next, "ProviderSelected", { releaseId: command.releaseId.value, providerReference: providerReference.value }),
    ]);
    return providerReference;
  }
}

export class AuthenticateProvider {
  constructor(private readonly deps: DistributionApplicationDependencies) {}

  async execute(command: SubmitPackageCommand): Promise<ProviderReceipt> {
    const current = await loadRelease(this.deps, command.releaseId);
    requireReleaseState(current, ["PROVIDER_SELECTED"]);
    const submission = await loadProviderSubmission(this.deps, command.releaseId);
    const next = current.transition("AUTHENTICATING_PROVIDER");
    await saveRelease(this.deps, next);
    const response = await resolve(this.deps.providerFramework.authenticate(submission.providerReference, current.release));
    const receipt = new ProviderReceipt(response.receipt);
    const updatedSubmission = new ProviderSubmissionAggregate({
      providerReference: submission.providerReference,
      receipt,
      status: response.status,
      releaseId: submission.releaseId,
      jobId: submission.jobId,
    });
    await saveProviderSubmission(this.deps, updatedSubmission);
    await publishMany(this.deps.events, [releaseEvent(next, "UploadStarted", { releaseId: command.releaseId.value, providerReference: submission.providerReference.value })]);
    return receipt;
  }
}

export class SubmitPackage {
  constructor(private readonly deps: DistributionApplicationDependencies) {}

  async execute(command: SubmitPackageCommand): Promise<void> {
    const current = await loadRelease(this.deps, command.releaseId);
    requireReleaseState(current, ["AUTHENTICATING_PROVIDER"]);
    const submission = await loadProviderSubmission(this.deps, command.releaseId);
    if (!current.packageModel) {
      throw new DomainInvariantError("Package model is required for submission", { releaseId: command.releaseId.value });
    }
    const uploading = current.transition("UPLOAD_IN_PROGRESS");
    await saveRelease(this.deps, uploading);
    const result = await resolve(this.deps.providerFramework.submitPackage(submission.providerReference, current.packageModel));
    const receipt = new ProviderReceipt(result.receipt);
    const updatedSubmission = new ProviderSubmissionAggregate({
      providerReference: submission.providerReference,
      receipt,
      status: result.status,
      releaseId: submission.releaseId,
      jobId: submission.jobId,
    });
    await saveProviderSubmission(this.deps, updatedSubmission);
    const next = uploading.transition("SUBMITTED_TO_PROVIDER");
    await saveRelease(this.deps, next);
    await publishMany(this.deps.events, [releaseEvent(next, "UploadCompleted", { releaseId: command.releaseId.value, providerReceipt: receipt.value })]);
  }
}

export class ProcessProviderStatus {
  constructor(private readonly deps: DistributionApplicationDependencies) {}

  async execute(command: SyncStatusCommand): Promise<ProviderStatus> {
    const current = await loadRelease(this.deps, command.releaseId);
    const submission = await loadProviderSubmission(this.deps, command.releaseId);
    const status = await resolve(this.deps.providerFramework.fetchStatus(submission.providerReference, current.release));
    const normalizedState = mapProviderStatusToState(status);
    let next = current;
    if (current.release.state !== normalizedState) {
      if (this.canTransition(current.release.state, normalizedState)) {
        next = current.transition(normalizedState);
        await saveRelease(this.deps, next);
      }
    }
    const updatedSubmission = new ProviderSubmissionAggregate({
      providerReference: submission.providerReference,
      receipt: submission.receipt,
      status,
      releaseId: submission.releaseId,
      jobId: submission.jobId,
    });
    await saveProviderSubmission(this.deps, updatedSubmission);
    const events: DistributionDomainEvent[] = [];
    if (normalizedState === "DSP_ACCEPTED") {
      events.push(releaseEvent(next, "ProviderAccepted", { releaseId: command.releaseId.value, providerReference: submission.providerReference.value }));
      events.push(releaseEvent(next, "DSPAccepted", { releaseId: command.releaseId.value, providerReference: submission.providerReference.value }));
    } else if (normalizedState === "DSP_LIVE") {
      events.push(releaseEvent(next, "DSPLive", { releaseId: command.releaseId.value, providerReference: submission.providerReference.value }));
    } else if (normalizedState === "REJECTED") {
      events.push(releaseEvent(next, "ProviderRejected", { releaseId: command.releaseId.value, reason: status.value }));
    }
    if (events.length > 0) await publishMany(this.deps.events, events);
    return status;
  }

  private canTransition(previous: DistributionState, next: DistributionState): boolean {
    return new DistributionStateMachine().canTransition(previous, next);
  }
}

export class SyncDistributionStatus {
  constructor(private readonly deps: DistributionApplicationDependencies) {}

  async execute(command: SyncStatusCommand): Promise<DistributionStatusResponse> {
    const status = await new ProcessProviderStatus(this.deps).execute(command);
    const release = await loadRelease(this.deps, command.releaseId);
    await resolve(this.deps.artistDashboard.projectRelease(command.releaseId));
    await resolve(this.deps.notificationSystem.notify("distribution_status_synced", { releaseId: command.releaseId.value, status: status.value }));
    return {
      releaseId: command.releaseId,
      state: release.release.state,
      packageFingerprint: release.release.packageFingerprint,
      manifestChecksum: release.release.manifestChecksum,
      providerReference: (await loadProviderSubmission(this.deps, command.releaseId)).providerReference,
      providerStatus: status,
      territories: release.release.territories,
    };
  }
}

export class ActivateCatalog {
  constructor(private readonly deps: DistributionApplicationDependencies) {}

  async execute(command: SyncStatusCommand): Promise<void> {
    const current = await loadRelease(this.deps, command.releaseId);
    requireReleaseState(current, ["DSP_LIVE"]);
    const next = current.transition("CATALOG_ACTIVE");
    await saveRelease(this.deps, next);
    await publishMany(this.deps.events, [releaseEvent(next, "DSPLive", { releaseId: command.releaseId.value, providerReference: (await loadProviderSubmission(this.deps, command.releaseId)).providerReference.value })]);
  }
}

export class ImportRoyalties {
  constructor(private readonly deps: DistributionApplicationDependencies) {}

  async execute(command: ImportRoyaltyCommand): Promise<RoyaltyResponse> {
    const current = await loadRelease(this.deps, command.releaseId);
    requireReleaseState(current, ["CATALOG_ACTIVE"]);
    const records = await resolve(this.deps.paymentSystem.importRoyalties(current.release));
    const batch = new RoyaltyBatchAggregate({
      id: new RoyaltyBatchId(`${command.releaseId.value}:royalty`),
      releaseId: command.releaseId,
    }).import(records);
    await saveRoyaltyBatch(this.deps, batch);
    const next = current.transition("ROYALTY_READY");
    await saveRelease(this.deps, next);
    await publishMany(this.deps.events, [releaseEvent(next, "RoyaltyImported", { releaseId: command.releaseId.value, royaltyBatchId: batch.id.value })]);
    return {
      releaseId: command.releaseId,
      royaltyBatchId: batch.id.value,
      amount: 0,
      currency: null,
      recordCount: records.length,
    };
  }
}

export class CalculateRevenue {
  constructor(private readonly deps: DistributionApplicationDependencies) {}

  async execute(command: ImportRoyaltyCommand): Promise<RoyaltyResponse> {
    const current = await loadRelease(this.deps, command.releaseId);
    requireReleaseState(current, ["ROYALTY_READY"]);
    const batch = await loadRoyaltyBatch(this.deps, command.releaseId);
    const calculated = await resolve(this.deps.paymentSystem.calculateRevenue(batch.records));
    const nextBatch = batch.calculate(calculated.amount, calculated.currency);
    await saveRoyaltyBatch(this.deps, nextBatch);
    const next = current.transition("ROYALTY_IMPORTED");
    await saveRelease(this.deps, next);
    await publishMany(this.deps.events, [releaseEvent(next, "RevenueCalculated", { releaseId: command.releaseId.value, royaltyBatchId: nextBatch.id.value, amount: calculated.amount, currency: calculated.currency })]);
    return {
      releaseId: command.releaseId,
      royaltyBatchId: nextBatch.id.value,
      amount: calculated.amount,
      currency: calculated.currency,
      recordCount: nextBatch.records.length,
    };
  }
}

export class ProcessPayments {
  constructor(private readonly deps: DistributionApplicationDependencies) {}

  async execute(command: ProcessPaymentCommand): Promise<PaymentResponse> {
    const current = await loadRelease(this.deps, command.releaseId);
    requireReleaseState(current, ["ROYALTY_IMPORTED"]);
    const batch = await loadRoyaltyBatch(this.deps, command.releaseId);
    if (batch.currency == null) {
      throw new DomainInvariantError("Royalty batch must be calculated before payment processing", { releaseId: command.releaseId.value });
    }
    const payment = await resolve(this.deps.paymentSystem.processPayments(current.release, batch.amount, batch.currency));
    const paymentRecord = payment instanceof PaymentRecord ? payment : payment;
    const nextBatch = batch.pay(paymentRecord);
    await saveRoyaltyBatch(this.deps, nextBatch);
    let next = current.transition("PAYMENT_PROCESSING");
    await saveRelease(this.deps, next);
    const statement = await resolve(this.deps.paymentSystem.generateStatement(paymentRecord));
    next = next.transition("STATEMENT_GENERATED");
    await saveRelease(this.deps, next);
    await publishMany(this.deps.events, [
      releaseEvent(next, "PaymentProcessed", { releaseId: command.releaseId.value, paymentReference: paymentRecord.paymentReference.value, royaltyBatchId: nextBatch.id.value }),
      releaseEvent(next, "StatementGenerated", { releaseId: command.releaseId.value, paymentReference: paymentRecord.paymentReference.value, statementReference: statement }),
    ]);
    return {
      releaseId: command.releaseId,
      paymentReference: paymentRecord.paymentReference.value,
      status: paymentRecord.status,
      amount: paymentRecord.amount,
      currency: paymentRecord.currency,
    };
  }
}

export class ArchiveRelease {
  constructor(private readonly deps: DistributionApplicationDependencies) {}

  async execute(command: ArchiveReleaseCommand): Promise<void> {
    const current = await loadRelease(this.deps, command.releaseId);
    requireReleaseState(current, ["STATEMENT_GENERATED"]);
    const next = current.transition("RELEASE_ARCHIVED");
    await saveRelease(this.deps, next);
    await publishMany(this.deps.events, [releaseEvent(next, "ReleaseArchived", { releaseId: command.releaseId.value })]);
  }
}

export class CancelDistribution {
  constructor(private readonly deps: DistributionApplicationDependencies) {}

  async execute(command: { releaseId: ReleaseId; requestedBy: string; reason: string }): Promise<void> {
    const current = await loadRelease(this.deps, command.releaseId);
    if (!new DistributionStateMachine().canTransition(current.release.state, "CANCELLED")) {
      throw new DomainInvariantError("Release cannot be cancelled in the current state", { releaseId: command.releaseId.value, state: current.release.state });
    }
    const next = current.transition("CANCELLED");
    await saveRelease(this.deps, next);
    await publishMany(this.deps.events, [releaseEvent(next, "ReleaseCancelled", { releaseId: command.releaseId.value, reason: command.reason, requestedBy: command.requestedBy })]);
  }
}

export class RequestTakedown {
  constructor(private readonly deps: DistributionApplicationDependencies) {}

  async execute(command: { releaseId: ReleaseId; requestedBy: string; reason: string }): Promise<void> {
    const current = await loadRelease(this.deps, command.releaseId);
    if (!new DistributionStateMachine().canTransition(current.release.state, "TAKEDOWN_PENDING")) {
      throw new DomainInvariantError("Release cannot request takedown from the current state", { releaseId: command.releaseId.value, state: current.release.state });
    }
    const next = current.transition("TAKEDOWN_PENDING");
    await saveRelease(this.deps, next);
    await publishMany(this.deps.events, [releaseEvent(next, "ReleaseTakenDown", { releaseId: command.releaseId.value, reason: command.reason, requestedBy: command.requestedBy })]);
  }
}
