import { AuditReference, Contributor, DistributionJobAggregate, DistributionJobId, DistributionVersion, ManifestChecksum, Package, PackageArtifact, PackageFingerprint, PaymentRecord, PaymentReference, ProviderReceipt, ProviderReference, ProviderStatus, ProviderSubmission, ProviderSubmissionAggregate, Release, ReleaseAggregate, ReleaseId, ReleaseVersion, RoyaltyBatchAggregate, RoyaltyBatchId, RoyaltyRecord, SnapshotId, SubmissionLock, TerritorySet, Track, } from "../../domain/index.js";
export class AggregateSerializer {
    serializeReleaseAggregate(aggregate) {
        return {
            release: this.serializeRelease(aggregate.release),
            packageModel: aggregate.packageModel ? this.serializePackage(aggregate.packageModel) : null,
            providerSubmission: aggregate.providerSubmission
                ? this.serializeProviderSubmissionEntity(aggregate.providerSubmission, aggregate.release.id)
                : null,
            royaltyBatchId: aggregate.royaltyBatchId?.value ?? null,
        };
    }
    deserializeReleaseAggregate(document) {
        return new ReleaseAggregate({
            release: this.deserializeRelease(document.release),
            packageModel: document.packageModel ? this.deserializePackage(document.packageModel) : null,
            providerSubmission: document.providerSubmission ? this.deserializeProviderSubmission(document.providerSubmission) : null,
            royaltyBatchId: document.royaltyBatchId ? new RoyaltyBatchId(document.royaltyBatchId) : null,
        });
    }
    serializeDistributionJobAggregate(aggregate) {
        return {
            id: aggregate.id.value,
            releaseId: aggregate.releaseId.value,
            state: aggregate.state,
            providerReference: aggregate.providerReference?.value ?? null,
            attempts: aggregate.attempts,
            lastError: aggregate.lastError,
        };
    }
    deserializeDistributionJobAggregate(document) {
        return new DistributionJobAggregate({
            id: new DistributionJobId(document.id),
            releaseId: new ReleaseId(document.releaseId),
            state: document.state,
            providerReference: document.providerReference ? new ProviderReference(document.providerReference) : null,
            attempts: document.attempts,
            lastError: document.lastError,
        });
    }
    serializeProviderSubmissionAggregate(aggregate) {
        return this.serializeProviderSubmissionAggregateRecord(aggregate);
    }
    deserializeProviderSubmissionAggregate(document) {
        return new ProviderSubmissionAggregate({
            providerReference: new ProviderReference(document.providerReference),
            receipt: document.providerReceipt ? new ProviderReceipt(document.providerReceipt) : null,
            status: new ProviderStatus(document.status),
            releaseId: new ReleaseId(document.releaseId),
            jobId: document.jobId ? new DistributionJobId(document.jobId) : null,
        });
    }
    serializeRoyaltyBatchAggregate(aggregate) {
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
    deserializeRoyaltyBatchAggregate(document) {
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
    serializeRelease(release) {
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
    deserializeRelease(document) {
        return new Release({
            id: new ReleaseId(document.id),
            title: document.title,
            version: document.version ? new ReleaseVersion(document.version) : null,
            state: document.state,
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
    serializeTrack(track) {
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
    deserializeTrack(track) {
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
    serializeContributor(contributor) {
        return {
            name: contributor.name,
            roles: contributor.roles,
            splitPercentage: contributor.splitPercentage,
            ipi: contributor.ipi,
            isPrimary: contributor.isPrimary,
            metadata: contributor.metadata,
        };
    }
    deserializeContributor(contributor) {
        return new Contributor({
            name: contributor.name,
            roles: contributor.roles,
            splitPercentage: contributor.splitPercentage,
            ipi: contributor.ipi,
            isPrimary: contributor.isPrimary,
            metadata: contributor.metadata,
        });
    }
    serializePackage(packageModel) {
        return {
            fingerprint: packageModel.fingerprint.value,
            manifestChecksum: packageModel.manifestChecksum.value,
            artifacts: packageModel.artifacts.map((artifact) => this.serializePackageArtifact(artifact)),
            version: packageModel.version.value,
            metadata: packageModel.metadata,
        };
    }
    deserializePackage(document) {
        return new Package({
            fingerprint: new PackageFingerprint(document.fingerprint),
            manifestChecksum: new ManifestChecksum(document.manifestChecksum),
            artifacts: document.artifacts.map((artifact) => this.deserializePackageArtifact(artifact)),
            version: new ReleaseVersion(document.version),
            metadata: document.metadata,
        });
    }
    serializePackageArtifact(artifact) {
        return {
            path: artifact.path,
            kind: artifact.kind,
            checksum: artifact.checksum,
            sizeBytes: artifact.sizeBytes,
            mediaType: artifact.mediaType,
            metadata: artifact.metadata,
        };
    }
    deserializePackageArtifact(artifact) {
        return new PackageArtifact({
            path: artifact.path,
            kind: artifact.kind,
            checksum: artifact.checksum,
            sizeBytes: artifact.sizeBytes,
            mediaType: artifact.mediaType,
            metadata: artifact.metadata,
        });
    }
    serializeProviderSubmissionEntity(submission, releaseId) {
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
    serializeProviderSubmissionAggregateRecord(submission) {
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
    deserializeProviderSubmission(document) {
        return new ProviderSubmission({
            providerReference: new ProviderReference(document.providerReference),
            providerReceipt: document.providerReceipt ? new ProviderReceipt(document.providerReceipt) : null,
            status: new ProviderStatus(document.status),
            submittedAt: document.submittedAt,
            lastUpdatedAt: document.lastUpdatedAt,
            metadata: document.metadata,
        });
    }
    serializeRoyaltyRecord(record) {
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
    deserializeRoyaltyRecord(record) {
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
    serializePaymentRecord(record) {
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
    deserializePaymentRecord(record) {
        return new PaymentRecord({
            paymentReference: new PaymentReference(record.paymentReference),
            royaltyBatchId: new RoyaltyBatchId(record.royaltyBatchId),
            amount: record.amount,
            currency: record.currency,
            status: record.status,
            processedAt: record.processedAt,
            statementReference: record.statementReference,
            metadata: record.metadata,
        });
    }
}
