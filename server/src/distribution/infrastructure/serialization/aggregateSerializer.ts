import {
  AuditReference,
  Contributor,
  DistributionJobAggregate,
  DistributionJobId,
  DistributionVersion,
  ManifestChecksum,
  Package,
  PackageArtifact,
  PackageFingerprint,
  PaymentRecord,
  PaymentReference,
  ProviderReceipt,
  ProviderReference,
  ProviderStatus,
  ProviderSubmission,
  ProviderSubmissionAggregate,
  Release,
  ReleaseAggregate,
  ReleaseId,
  ReleaseVersion,
  RoyaltyBatchAggregate,
  RoyaltyBatchId,
  RoyaltyRecord,
  SnapshotId,
  SubmissionLock,
  TerritorySet,
  Track,
  type ProviderStatusValue,
} from "../../domain";

type SerializedContributor = Readonly<{
  name: string;
  roles: readonly string[];
  splitPercentage: number | null;
  ipi: string | null;
  isPrimary: boolean;
  metadata: Readonly<Record<string, unknown>>;
}>;

type SerializedTrack = Readonly<{
  id: string;
  title: string;
  version: string | null;
  discNumber: number;
  trackNumber: number;
  contributors: readonly SerializedContributor[];
  territories: readonly string[];
  isrc: string | null;
  audioReference: string | null;
  audioChecksum: string | null;
  artworkReference: string | null;
  explicit: boolean;
  lyrics: string | null;
  metadata: Readonly<Record<string, unknown>>;
}>;

type SerializedRelease = Readonly<{
  id: string;
  title: string;
  version: string | null;
  state: string;
  primaryArtist: string;
  contributors: readonly SerializedContributor[];
  tracks: readonly SerializedTrack[];
  label: string | null;
  upc: string | null;
  releaseDate: string | null;
  originalReleaseDate: string | null;
  territories: readonly string[];
  packageFingerprint: string | null;
  manifestChecksum: string | null;
  submissionLock: null | Readonly<{ token: string; owner: string; acquiredAt: string; expiresAt: string | null }>;
  snapshotId: string | null;
  distributionVersion: string;
  auditReference: string | null;
  metadata: Readonly<Record<string, unknown>>;
}>;

type SerializedPackageArtifact = Readonly<{
  path: string;
  kind: string;
  checksum: string | null;
  sizeBytes: number | null;
  mediaType: string | null;
  metadata: Readonly<Record<string, unknown>>;
}>;

type SerializedPackage = Readonly<{
  fingerprint: string;
  manifestChecksum: string;
  artifacts: readonly SerializedPackageArtifact[];
  version: string;
  metadata: Readonly<Record<string, unknown>>;
}>;

type SerializedProviderSubmission = Readonly<{
  providerReference: string;
  providerReceipt: string | null;
  status: ProviderStatusValue;
  submittedAt: string;
  lastUpdatedAt: string | null;
  releaseId: string;
  jobId: string | null;
  metadata: Readonly<Record<string, unknown>>;
}>;

type SerializedRoyaltyRecord = Readonly<{
  royaltyBatchId: string;
  releaseId: string;
  trackId: string | null;
  territory: string | null;
  units: number;
  revenue: number;
  currency: string;
  source: string;
  importedAt: string;
  metadata: Readonly<Record<string, unknown>>;
}>;

type SerializedPaymentRecord = Readonly<{
  paymentReference: string;
  royaltyBatchId: string;
  amount: number;
  currency: string;
  status: string;
  processedAt: string | null;
  statementReference: string | null;
  metadata: Readonly<Record<string, unknown>>;
}>;

type SerializedDistributionJob = Readonly<{
  id: string;
  releaseId: string;
  state: "PENDING" | "QUEUED" | "PROCESSING" | "COMPLETED" | "FAILED" | "CANCELLED";
  providerReference: string | null;
  attempts: number;
  lastError: string | null;
}>;

export class AggregateSerializer {
  serializeReleaseAggregate(aggregate: ReleaseAggregate): SerializedReleaseAggregateDocument {
    return {
      release: this.serializeRelease(aggregate.release),
      packageModel: aggregate.packageModel ? this.serializePackage(aggregate.packageModel) : null,
      providerSubmission: aggregate.providerSubmission
        ? this.serializeProviderSubmissionEntity(aggregate.providerSubmission, aggregate.release.id)
        : null,
      royaltyBatchId: aggregate.royaltyBatchId?.value ?? null,
    };
  }

  deserializeReleaseAggregate(document: SerializedReleaseAggregateDocument): ReleaseAggregate {
    return new ReleaseAggregate({
      release: this.deserializeRelease(document.release),
      packageModel: document.packageModel ? this.deserializePackage(document.packageModel) : null,
      providerSubmission: document.providerSubmission ? this.deserializeProviderSubmission(document.providerSubmission) : null,
      royaltyBatchId: document.royaltyBatchId ? new RoyaltyBatchId(document.royaltyBatchId) : null,
    });
  }

  serializeDistributionJobAggregate(aggregate: DistributionJobAggregate): SerializedDistributionJob {
    return {
      id: aggregate.id.value,
      releaseId: aggregate.releaseId.value,
      state: aggregate.state,
      providerReference: aggregate.providerReference?.value ?? null,
      attempts: aggregate.attempts,
      lastError: aggregate.lastError,
    };
  }

  deserializeDistributionJobAggregate(document: SerializedDistributionJob): DistributionJobAggregate {
    return new DistributionJobAggregate({
      id: new DistributionJobId(document.id),
      releaseId: new ReleaseId(document.releaseId),
      state: document.state,
      providerReference: document.providerReference ? new ProviderReference(document.providerReference) : null,
      attempts: document.attempts,
      lastError: document.lastError,
    });
  }

  serializeProviderSubmissionAggregate(aggregate: ProviderSubmissionAggregate): SerializedProviderSubmission {
    return this.serializeProviderSubmissionAggregateRecord(aggregate);
  }

  deserializeProviderSubmissionAggregate(document: SerializedProviderSubmission): ProviderSubmissionAggregate {
    return new ProviderSubmissionAggregate({
      providerReference: new ProviderReference(document.providerReference),
      receipt: document.providerReceipt ? new ProviderReceipt(document.providerReceipt) : null,
      status: new ProviderStatus(document.status),
      releaseId: new ReleaseId(document.releaseId),
      jobId: document.jobId ? new DistributionJobId(document.jobId) : null,
    });
  }

  serializeRoyaltyBatchAggregate(aggregate: RoyaltyBatchAggregate): SerializedRoyaltyBatchAggregateDocument {
    return {
      id: aggregate.id.value,
      releaseId: aggregate.releaseId.value,
      records: aggregate.records.map((record) => this.serializeRoyaltyRecord(record)),
      paymentRecords: aggregate.paymentRecords.map((record) => this.serializePaymentRecord(record)),
      state: aggregate.state,
      amount: aggregate.amount,
      currency: aggregate.currency,
      auditReference: aggregate.auditReference?.value ?? null,
    };
  }

  deserializeRoyaltyBatchAggregate(document: SerializedRoyaltyBatchAggregateDocument): RoyaltyBatchAggregate {
    return new RoyaltyBatchAggregate({
      id: new RoyaltyBatchId(document.id),
      releaseId: new ReleaseId(document.releaseId),
      records: document.records.map((record) => this.deserializeRoyaltyRecord(record)),
      paymentRecords: document.paymentRecords.map((record) => this.deserializePaymentRecord(record)),
      state: document.state,
      amount: document.amount,
      currency: document.currency,
      auditReference: document.auditReference ? new AuditReference(document.auditReference) : null,
    });
  }

  private serializeRelease(release: Release): SerializedRelease {
    return {
      id: release.id.value,
      title: release.title,
      version: release.version?.value ?? null,
      state: release.state,
      primaryArtist: release.primaryArtist,
      contributors: release.contributors.map((contributor) => this.serializeContributor(contributor)),
      tracks: release.tracks.map((track) => this.serializeTrack(track)),
      label: release.label,
      upc: release.upc,
      releaseDate: release.releaseDate,
      originalReleaseDate: release.originalReleaseDate,
      territories: release.territories.values,
      packageFingerprint: release.packageFingerprint?.value ?? null,
      manifestChecksum: release.manifestChecksum?.value ?? null,
      submissionLock: release.submissionLock ? {
        token: release.submissionLock.token,
        owner: release.submissionLock.owner,
        acquiredAt: release.submissionLock.acquiredAt,
        expiresAt: release.submissionLock.expiresAt,
      } : null,
      snapshotId: release.snapshotId?.value ?? null,
      distributionVersion: release.distributionVersion.value,
      auditReference: release.auditReference?.value ?? null,
      metadata: release.metadata,
    };
  }

  private deserializeRelease(document: SerializedRelease): Release {
    return new Release({
      id: new ReleaseId(document.id),
      title: document.title,
      version: document.version ? new ReleaseVersion(document.version) : null,
      state: document.state as Release["state"],
      primaryArtist: document.primaryArtist,
      contributors: document.contributors.map((contributor) => this.deserializeContributor(contributor)),
      tracks: document.tracks.map((track) => this.deserializeTrack(track)),
      label: document.label,
      upc: document.upc,
      releaseDate: document.releaseDate,
      originalReleaseDate: document.originalReleaseDate,
      territories: new TerritorySet(document.territories),
      packageFingerprint: document.packageFingerprint ? new PackageFingerprint(document.packageFingerprint) : null,
      manifestChecksum: document.manifestChecksum ? new ManifestChecksum(document.manifestChecksum) : null,
      submissionLock: document.submissionLock ? new SubmissionLock(document.submissionLock) : null,
      snapshotId: document.snapshotId ? new SnapshotId(document.snapshotId) : null,
      distributionVersion: new DistributionVersion(document.distributionVersion),
      auditReference: document.auditReference ? new AuditReference(document.auditReference) : null,
      metadata: document.metadata,
    });
  }

  private serializeTrack(track: Track): SerializedTrack {
    return {
      id: track.id,
      title: track.title,
      version: track.version?.value ?? null,
      discNumber: track.discNumber,
      trackNumber: track.trackNumber,
      contributors: track.contributors.map((contributor) => this.serializeContributor(contributor)),
      territories: track.territories.values,
      isrc: track.isrc,
      audioReference: track.audioReference,
      audioChecksum: track.audioChecksum,
      artworkReference: track.artworkReference,
      explicit: track.explicit,
      lyrics: track.lyrics,
      metadata: track.metadata,
    };
  }

  private deserializeTrack(track: SerializedTrack): Track {
    return new Track({
      id: track.id,
      title: track.title,
      version: track.version ? new ReleaseVersion(track.version) : null,
      discNumber: track.discNumber,
      trackNumber: track.trackNumber,
      contributors: track.contributors.map((contributor) => this.deserializeContributor(contributor)),
      territories: new TerritorySet(track.territories),
      isrc: track.isrc,
      audioReference: track.audioReference,
      audioChecksum: track.audioChecksum,
      artworkReference: track.artworkReference,
      explicit: track.explicit,
      lyrics: track.lyrics,
      metadata: track.metadata,
    });
  }

  private serializeContributor(contributor: Contributor): SerializedContributor {
    return {
      name: contributor.name,
      roles: contributor.roles,
      splitPercentage: contributor.splitPercentage,
      ipi: contributor.ipi,
      isPrimary: contributor.isPrimary,
      metadata: contributor.metadata,
    };
  }

  private deserializeContributor(contributor: SerializedContributor): Contributor {
    return new Contributor({
      name: contributor.name,
      roles: contributor.roles,
      splitPercentage: contributor.splitPercentage,
      ipi: contributor.ipi,
      isPrimary: contributor.isPrimary,
      metadata: contributor.metadata,
    });
  }

  private serializePackage(packageModel: Package): SerializedPackage {
    return {
      fingerprint: packageModel.fingerprint.value,
      manifestChecksum: packageModel.manifestChecksum.value,
      artifacts: packageModel.artifacts.map((artifact) => this.serializePackageArtifact(artifact)),
      version: packageModel.version.value,
      metadata: packageModel.metadata,
    };
  }

  private deserializePackage(document: SerializedPackage): Package {
    return new Package({
      fingerprint: new PackageFingerprint(document.fingerprint),
      manifestChecksum: new ManifestChecksum(document.manifestChecksum),
      artifacts: document.artifacts.map((artifact) => this.deserializePackageArtifact(artifact)),
      version: new ReleaseVersion(document.version),
      metadata: document.metadata,
    });
  }

  private serializePackageArtifact(artifact: PackageArtifact): SerializedPackageArtifact {
    return {
      path: artifact.path,
      kind: artifact.kind,
      checksum: artifact.checksum,
      sizeBytes: artifact.sizeBytes,
      mediaType: artifact.mediaType,
      metadata: artifact.metadata,
    };
  }

  private deserializePackageArtifact(artifact: SerializedPackageArtifact): PackageArtifact {
    return new PackageArtifact({
      path: artifact.path,
      kind: artifact.kind,
      checksum: artifact.checksum,
      sizeBytes: artifact.sizeBytes,
      mediaType: artifact.mediaType,
      metadata: artifact.metadata,
    });
  }

  private serializeProviderSubmissionEntity(submission: ProviderSubmission, releaseId: ReleaseId): SerializedProviderSubmission {
    return {
      providerReference: submission.providerReference.value,
      providerReceipt: submission.providerReceipt?.value ?? null,
      status: submission.status.value,
      submittedAt: submission.submittedAt,
      lastUpdatedAt: submission.lastUpdatedAt,
      releaseId: releaseId.value,
      jobId: null,
      metadata: submission.metadata,
    };
  }

  private serializeProviderSubmissionAggregateRecord(submission: ProviderSubmissionAggregate): SerializedProviderSubmission {
    return {
      providerReference: submission.providerReference.value,
      providerReceipt: submission.receipt?.value ?? null,
      status: submission.status.value,
      submittedAt: new Date().toISOString(),
      lastUpdatedAt: null,
      releaseId: submission.releaseId.value,
      jobId: submission.jobId?.value ?? null,
      metadata: {},
    };
  }

  private deserializeProviderSubmission(document: SerializedProviderSubmission): ProviderSubmission {
    return new ProviderSubmission({
      providerReference: new ProviderReference(document.providerReference),
      providerReceipt: document.providerReceipt ? new ProviderReceipt(document.providerReceipt) : null,
      status: new ProviderStatus(document.status),
      submittedAt: document.submittedAt,
      lastUpdatedAt: document.lastUpdatedAt,
      metadata: document.metadata,
    });
  }

  private serializeRoyaltyRecord(record: RoyaltyRecord): SerializedRoyaltyRecord {
    return {
      royaltyBatchId: record.royaltyBatchId.value,
      releaseId: record.releaseId.value,
      trackId: record.trackId,
      territory: record.territory,
      units: record.units,
      revenue: record.revenue,
      currency: record.currency,
      source: record.source,
      importedAt: record.importedAt,
      metadata: record.metadata,
    };
  }

  private deserializeRoyaltyRecord(record: SerializedRoyaltyRecord): RoyaltyRecord {
    return new RoyaltyRecord({
      royaltyBatchId: new RoyaltyBatchId(record.royaltyBatchId),
      releaseId: new ReleaseId(record.releaseId),
      trackId: record.trackId,
      territory: record.territory,
      units: record.units,
      revenue: record.revenue,
      currency: record.currency,
      source: record.source,
      importedAt: record.importedAt,
      metadata: record.metadata,
    });
  }

  private serializePaymentRecord(record: PaymentRecord): SerializedPaymentRecord {
    return {
      paymentReference: record.paymentReference.value,
      royaltyBatchId: record.royaltyBatchId.value,
      amount: record.amount,
      currency: record.currency,
      status: record.status,
      processedAt: record.processedAt,
      statementReference: record.statementReference,
      metadata: record.metadata,
    };
  }

  private deserializePaymentRecord(record: SerializedPaymentRecord): PaymentRecord {
    return new PaymentRecord({
      paymentReference: new PaymentReference(record.paymentReference),
      royaltyBatchId: new RoyaltyBatchId(record.royaltyBatchId),
      amount: record.amount,
      currency: record.currency,
      status: record.status as PaymentRecord["status"],
      processedAt: record.processedAt,
      statementReference: record.statementReference,
      metadata: record.metadata,
    });
  }
}

export type SerializedReleaseAggregateDocument = Readonly<{
  release: SerializedRelease;
  packageModel: SerializedPackage | null;
  providerSubmission: SerializedProviderSubmission | null;
  royaltyBatchId: string | null;
}>;

export type SerializedDistributionJobDocument = SerializedDistributionJob;
export type SerializedProviderSubmissionDocument = SerializedProviderSubmission;
export type SerializedRoyaltyBatchAggregateDocument = Readonly<{
  id: string;
  releaseId: string;
  records: readonly SerializedRoyaltyRecord[];
  paymentRecords: readonly SerializedPaymentRecord[];
  state: "CREATED" | "IMPORTED" | "CALCULATED" | "PAID" | "ARCHIVED" | "REJECTED";
  amount: number;
  currency: string | null;
  auditReference: string | null;
}>;
