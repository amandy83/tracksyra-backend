import { DomainInvariantError } from "./domainErrors";
import { freeze } from "./domainHelpers";
import { DistributionState, DistributionStateMachine } from "./distributionState";
import { ApprovalGranted, ApprovalRejected, DSPAccepted, DSPLive, DistributionJobCreated, MetadataGenerated, PackageBuilt, PackageVerified, PaymentProcessed, ProviderAccepted, ProviderRejected, ProviderSelected, ReleaseArchived, ReleaseCancelled, ReleaseTakenDown, RevenueCalculated, SnapshotCreated, StatementGenerated, SubmissionLocked, SubmissionStarted, UploadCompleted, UploadStarted, ValidationFailed, ValidationPassed, RoyaltyImported } from "./events";
import { Package, PaymentRecord, ProviderSubmission, RoyaltyRecord, Release, Track } from "./entities";
import { AuditReference, DistributionJobId, ManifestChecksum, PackageFingerprint, PaymentReference, ProviderReceipt, ProviderReference, ProviderStatus, ReleaseId, ReleaseVersion, RoyaltyBatchId, SnapshotId, SubmissionLock, TerritorySet } from "./valueObjects";

type JobState = "PENDING" | "QUEUED" | "PROCESSING" | "COMPLETED" | "FAILED" | "CANCELLED";
type RoyaltyBatchState = "CREATED" | "IMPORTED" | "CALCULATED" | "PAID" | "ARCHIVED" | "REJECTED";

export class ReleaseAggregate {
  readonly release: Release;
  readonly stateMachine: DistributionStateMachine;
  readonly packageModel: Package | null;
  readonly providerSubmission: ProviderSubmission | null;
  readonly royaltyBatchId: RoyaltyBatchId | null;

  constructor(input: {
    release: Release;
    packageModel?: Package | null;
    providerSubmission?: ProviderSubmission | null;
    royaltyBatchId?: RoyaltyBatchId | null;
    stateMachine?: DistributionStateMachine;
  }) {
    this.release = input.release;
    this.packageModel = input.packageModel ?? null;
    this.providerSubmission = input.providerSubmission ?? null;
    this.royaltyBatchId = input.royaltyBatchId ?? null;
    this.stateMachine = input.stateMachine ?? new DistributionStateMachine();
    freeze(this);
  }

  static create(releaseId: ReleaseId, title: string, primaryArtist: string, version?: ReleaseVersion | null, territories?: TerritorySet): ReleaseAggregate {
    return new ReleaseAggregate({
      release: new Release({
        id: releaseId,
        title,
        primaryArtist,
        version,
        territories,
      }),
    });
  }

  lockSubmission(lock: SubmissionLock): ReleaseAggregate {
    this.stateMachine.assertTransition(this.release.state, "SUBMISSION_LOCKED");
    return new ReleaseAggregate({
      release: new Release({ ...this.release, submissionLock: lock, state: "SUBMISSION_LOCKED" }),
      packageModel: this.packageModel,
      providerSubmission: this.providerSubmission,
      royaltyBatchId: this.royaltyBatchId,
      stateMachine: this.stateMachine,
    });
  }

  createSnapshot(snapshotId: SnapshotId): ReleaseAggregate {
    this.stateMachine.assertTransition(this.release.state, "SNAPSHOT_CREATED");
    return new ReleaseAggregate({
      release: new Release({ ...this.release, snapshotId, state: "SNAPSHOT_CREATED" }),
      packageModel: this.packageModel,
      providerSubmission: this.providerSubmission,
      royaltyBatchId: this.royaltyBatchId,
      stateMachine: this.stateMachine,
    });
  }

  transition(next: DistributionState): ReleaseAggregate {
    this.stateMachine.assertTransition(this.release.state, next);
    return new ReleaseAggregate({
      release: this.release.withState(next),
      packageModel: this.packageModel,
      providerSubmission: this.providerSubmission,
      royaltyBatchId: this.royaltyBatchId,
      stateMachine: this.stateMachine,
    });
  }

  withPackage(packageModel: Package): ReleaseAggregate {
    return new ReleaseAggregate({
      release: this.release,
      packageModel,
      providerSubmission: this.providerSubmission,
      royaltyBatchId: this.royaltyBatchId,
      stateMachine: this.stateMachine,
    });
  }

  withProviderSubmission(providerSubmission: ProviderSubmission): ReleaseAggregate {
    return new ReleaseAggregate({
      release: this.release,
      packageModel: this.packageModel,
      providerSubmission,
      royaltyBatchId: this.royaltyBatchId,
      stateMachine: this.stateMachine,
    });
  }

  withRoyaltyBatch(royaltyBatchId: RoyaltyBatchId): ReleaseAggregate {
    return new ReleaseAggregate({
      release: this.release,
      packageModel: this.packageModel,
      providerSubmission: this.providerSubmission,
      royaltyBatchId,
      stateMachine: this.stateMachine,
    });
  }
}

export class DistributionJobAggregate {
  readonly id: DistributionJobId;
  readonly releaseId: ReleaseId;
  readonly state: JobState;
  readonly providerReference: ProviderReference | null;
  readonly attempts: number;
  readonly lastError: string | null;

  constructor(input: {
    id: DistributionJobId;
    releaseId: ReleaseId;
    state?: JobState;
    providerReference?: ProviderReference | null;
    attempts?: number;
    lastError?: string | null;
  }) {
    this.id = input.id;
    this.releaseId = input.releaseId;
    this.state = input.state ?? "PENDING";
    this.providerReference = input.providerReference ?? null;
    this.attempts = input.attempts ?? 0;
    this.lastError = input.lastError ?? null;
    freeze(this);
  }

  queue(): DistributionJobAggregate {
    if (this.state !== "PENDING") throw new DomainInvariantError("Distribution job can only be queued from PENDING", { state: this.state });
    return new DistributionJobAggregate({ ...this, state: "QUEUED" });
  }

  start(): DistributionJobAggregate {
    if (this.state !== "QUEUED") throw new DomainInvariantError("Distribution job can only start from QUEUED", { state: this.state });
    return new DistributionJobAggregate({ ...this, state: "PROCESSING", attempts: this.attempts + 1 });
  }

  complete(): DistributionJobAggregate {
    if (this.state !== "PROCESSING") throw new DomainInvariantError("Distribution job can only complete from PROCESSING", { state: this.state });
    return new DistributionJobAggregate({ ...this, state: "COMPLETED" });
  }

  fail(lastError: string): DistributionJobAggregate {
    if (this.state !== "PROCESSING") throw new DomainInvariantError("Distribution job can only fail from PROCESSING", { state: this.state });
    return new DistributionJobAggregate({ ...this, state: "FAILED", lastError });
  }
}

export class ProviderSubmissionAggregate {
  readonly providerReference: ProviderReference;
  readonly receipt: ProviderReceipt | null;
  readonly status: ProviderStatus;
  readonly releaseId: ReleaseId;
  readonly jobId: DistributionJobId | null;

  constructor(input: {
    providerReference: ProviderReference;
    receipt?: ProviderReceipt | null;
    status?: ProviderStatus;
    releaseId: ReleaseId;
    jobId?: DistributionJobId | null;
  }) {
    this.providerReference = input.providerReference;
    this.receipt = input.receipt ?? null;
    this.status = input.status ?? new ProviderStatus("PENDING");
    this.releaseId = input.releaseId;
    this.jobId = input.jobId ?? null;
    freeze(this);
  }

  authenticate(): ProviderSubmissionAggregate {
    return new ProviderSubmissionAggregate({ ...this, status: new ProviderStatus("AUTHENTICATING") });
  }

  uploadStarted(): ProviderSubmissionAggregate {
    return new ProviderSubmissionAggregate({ ...this, status: new ProviderStatus("UPLOADING") });
  }

  uploadCompleted(receipt: ProviderReceipt): ProviderSubmissionAggregate {
    return new ProviderSubmissionAggregate({ ...this, receipt, status: new ProviderStatus("PROCESSING") });
  }

  providerAccepted(): ProviderSubmissionAggregate {
    return new ProviderSubmissionAggregate({ ...this, status: new ProviderStatus("ACCEPTED") });
  }

  providerRejected(): ProviderSubmissionAggregate {
    return new ProviderSubmissionAggregate({ ...this, status: new ProviderStatus("REJECTED") });
  }

  dspAccepted(): ProviderSubmissionAggregate {
    return new ProviderSubmissionAggregate({ ...this, status: new ProviderStatus("LIVE") });
  }
}

export class RoyaltyBatchAggregate {
  readonly id: RoyaltyBatchId;
  readonly releaseId: ReleaseId;
  readonly records: readonly RoyaltyRecord[];
  readonly paymentRecords: readonly PaymentRecord[];
  readonly state: RoyaltyBatchState;
  readonly amount: number;
  readonly currency: string | null;
  readonly auditReference: AuditReference | null;

  constructor(input: {
    id: RoyaltyBatchId;
    releaseId: ReleaseId;
    records?: readonly RoyaltyRecord[];
    paymentRecords?: readonly PaymentRecord[];
    state?: RoyaltyBatchState;
    amount?: number;
    currency?: string | null;
    auditReference?: AuditReference | null;
  }) {
    this.id = input.id;
    this.releaseId = input.releaseId;
    this.records = freeze([...(input.records ?? [])]);
    this.paymentRecords = freeze([...(input.paymentRecords ?? [])]);
    this.state = input.state ?? "CREATED";
    this.amount = input.amount ?? 0;
    this.currency = input.currency ?? null;
    this.auditReference = input.auditReference ?? null;
    freeze(this);
  }

  import(records: readonly RoyaltyRecord[]): RoyaltyBatchAggregate {
    if (this.state !== "CREATED") throw new DomainInvariantError("Royalty batch can only import from CREATED", { state: this.state });
    return new RoyaltyBatchAggregate({ ...this, records: [...this.records, ...records], state: "IMPORTED" });
  }

  calculate(amount: number, currency: string): RoyaltyBatchAggregate {
    if (this.state !== "IMPORTED") throw new DomainInvariantError("Royalty batch can only calculate from IMPORTED", { state: this.state });
    return new RoyaltyBatchAggregate({ ...this, amount, currency, state: "CALCULATED" });
  }

  pay(paymentRecord: PaymentRecord): RoyaltyBatchAggregate {
    if (this.state !== "CALCULATED") throw new DomainInvariantError("Royalty batch can only pay from CALCULATED", { state: this.state });
    return new RoyaltyBatchAggregate({ ...this, paymentRecords: [...this.paymentRecords, paymentRecord], state: "PAID" });
  }

  archive(): RoyaltyBatchAggregate {
    if (this.state !== "PAID") throw new DomainInvariantError("Royalty batch can only archive from PAID", { state: this.state });
    return new RoyaltyBatchAggregate({ ...this, state: "ARCHIVED" });
  }
}

