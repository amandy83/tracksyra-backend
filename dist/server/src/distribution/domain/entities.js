import { DomainInvariantError } from "./domainErrors.js";
import { freeze, normalizeOptionalText, normalizePositiveInteger, normalizeToken, normalizeNonNegativeInteger, normalizeText } from "./domainHelpers.js";
import { DistributionVersion, TerritorySet, normalizeContributorShare, } from "./valueObjects.js";
export class Contributor {
    name;
    roles;
    splitPercentage;
    ipi;
    isPrimary;
    metadata;
    constructor(input) {
        this.name = normalizeText(input.name, "Contributor.name", 256);
        this.roles = freeze([...new Set(input.roles.map((role) => normalizeToken(role, "Contributor.role", 1, 64)))]);
        this.splitPercentage = input.splitPercentage == null ? null : normalizeContributorShare(input.splitPercentage);
        this.ipi = normalizeOptionalText(input.ipi, "Contributor.ipi", 64);
        this.isPrimary = input.isPrimary ?? false;
        this.metadata = freeze({ ...(input.metadata ?? {}) });
        if (this.roles.length === 0) {
            throw new DomainInvariantError("Contributor must have at least one role", { name: this.name });
        }
        freeze(this);
    }
    withSplitPercentage(splitPercentage) {
        return new Contributor({
            name: this.name,
            roles: this.roles,
            splitPercentage,
            ipi: this.ipi,
            isPrimary: this.isPrimary,
            metadata: this.metadata,
        });
    }
}
export class Track {
    id;
    title;
    version;
    discNumber;
    trackNumber;
    contributors;
    territories;
    isrc;
    audioReference;
    audioChecksum;
    artworkReference;
    explicit;
    lyrics;
    metadata;
    constructor(input) {
        this.id = normalizeToken(input.id, "Track.id");
        this.title = normalizeText(input.title, "Track.title", 256);
        this.version = input.version ?? null;
        this.discNumber = normalizePositiveInteger(input.discNumber, "Track.discNumber");
        this.trackNumber = normalizePositiveInteger(input.trackNumber, "Track.trackNumber");
        this.contributors = freeze([...(input.contributors ?? [])]);
        this.territories = input.territories ?? new TerritorySet([]);
        this.isrc = normalizeOptionalText(input.isrc, "Track.isrc", 32);
        this.audioReference = normalizeOptionalText(input.audioReference, "Track.audioReference", 256);
        this.audioChecksum = normalizeOptionalText(input.audioChecksum, "Track.audioChecksum", 64);
        this.artworkReference = normalizeOptionalText(input.artworkReference, "Track.artworkReference", 256);
        this.explicit = input.explicit ?? false;
        this.lyrics = normalizeOptionalText(input.lyrics, "Track.lyrics", 20000);
        this.metadata = freeze({ ...(input.metadata ?? {}) });
        freeze(this);
    }
    addContributor(contributor) {
        return new Track({
            id: this.id,
            title: this.title,
            version: this.version,
            discNumber: this.discNumber,
            trackNumber: this.trackNumber,
            contributors: [...this.contributors, contributor],
            territories: this.territories,
            isrc: this.isrc,
            audioReference: this.audioReference,
            audioChecksum: this.audioChecksum,
            artworkReference: this.artworkReference,
            explicit: this.explicit,
            lyrics: this.lyrics,
            metadata: this.metadata,
        });
    }
}
export class Release {
    id;
    title;
    version;
    state;
    primaryArtist;
    contributors;
    tracks;
    label;
    upc;
    releaseDate;
    originalReleaseDate;
    territories;
    packageFingerprint;
    manifestChecksum;
    submissionLock;
    snapshotId;
    distributionVersion;
    auditReference;
    metadata;
    constructor(input) {
        this.id = input.id;
        this.title = normalizeText(input.title, "Release.title", 256);
        this.version = input.version ?? null;
        this.state = input.state ?? "DRAFT";
        this.primaryArtist = normalizeText(input.primaryArtist, "Release.primaryArtist", 256);
        this.contributors = freeze([...(input.contributors ?? [])]);
        this.tracks = freeze([...(input.tracks ?? [])]);
        this.label = normalizeOptionalText(input.label, "Release.label", 128);
        this.upc = normalizeOptionalText(input.upc, "Release.upc", 32);
        this.releaseDate = normalizeOptionalText(input.releaseDate, "Release.releaseDate", 32);
        this.originalReleaseDate = normalizeOptionalText(input.originalReleaseDate, "Release.originalReleaseDate", 32);
        this.territories = input.territories ?? new TerritorySet([]);
        this.packageFingerprint = input.packageFingerprint ?? null;
        this.manifestChecksum = input.manifestChecksum ?? null;
        this.submissionLock = input.submissionLock ?? null;
        this.snapshotId = input.snapshotId ?? null;
        this.distributionVersion = input.distributionVersion ?? new DistributionVersion("1.0");
        this.auditReference = input.auditReference ?? null;
        this.metadata = freeze({ ...(input.metadata ?? {}) });
        freeze(this);
    }
    withState(state) {
        return new Release({
            id: this.id,
            title: this.title,
            primaryArtist: this.primaryArtist,
            version: this.version,
            state,
            contributors: this.contributors,
            tracks: this.tracks,
            label: this.label,
            upc: this.upc,
            releaseDate: this.releaseDate,
            originalReleaseDate: this.originalReleaseDate,
            territories: this.territories,
            packageFingerprint: this.packageFingerprint,
            manifestChecksum: this.manifestChecksum,
            submissionLock: this.submissionLock,
            snapshotId: this.snapshotId,
            distributionVersion: this.distributionVersion,
            auditReference: this.auditReference,
            metadata: this.metadata,
        });
    }
}
export class PackageArtifact {
    path;
    kind;
    checksum;
    sizeBytes;
    mediaType;
    metadata;
    constructor(input) {
        this.path = normalizeToken(input.path, "PackageArtifact.path", 1, 512);
        this.kind = normalizeToken(input.kind, "PackageArtifact.kind", 1, 64);
        this.checksum = normalizeOptionalText(input.checksum, "PackageArtifact.checksum", 64);
        this.sizeBytes = input.sizeBytes == null ? null : normalizeNonNegativeInteger(input.sizeBytes, "PackageArtifact.sizeBytes");
        this.mediaType = normalizeOptionalText(input.mediaType, "PackageArtifact.mediaType", 128);
        this.metadata = freeze({ ...(input.metadata ?? {}) });
        freeze(this);
    }
}
export class Package {
    fingerprint;
    manifestChecksum;
    artifacts;
    version;
    metadata;
    constructor(input) {
        this.fingerprint = input.fingerprint;
        this.manifestChecksum = input.manifestChecksum;
        this.artifacts = freeze([...(input.artifacts ?? [])]);
        this.version = input.version;
        this.metadata = freeze({ ...(input.metadata ?? {}) });
        freeze(this);
    }
}
export class ProviderSubmission {
    providerReference;
    providerReceipt;
    status;
    submittedAt;
    lastUpdatedAt;
    metadata;
    constructor(input) {
        this.providerReference = input.providerReference;
        this.providerReceipt = input.providerReceipt ?? null;
        this.status = input.status;
        this.submittedAt = input.submittedAt ?? new Date().toISOString();
        this.lastUpdatedAt = normalizeOptionalText(input.lastUpdatedAt, "ProviderSubmission.lastUpdatedAt", 32);
        this.metadata = freeze({ ...(input.metadata ?? {}) });
        freeze(this);
    }
    withStatus(status) {
        return new ProviderSubmission({
            providerReference: this.providerReference,
            providerReceipt: this.providerReceipt,
            status,
            submittedAt: this.submittedAt,
            lastUpdatedAt: new Date().toISOString(),
            metadata: this.metadata,
        });
    }
}
export class RoyaltyRecord {
    royaltyBatchId;
    releaseId;
    trackId;
    territory;
    units;
    revenue;
    currency;
    source;
    importedAt;
    metadata;
    constructor(input) {
        this.royaltyBatchId = input.royaltyBatchId;
        this.releaseId = input.releaseId;
        this.trackId = normalizeOptionalText(input.trackId, "RoyaltyRecord.trackId", 128);
        this.territory = normalizeOptionalText(input.territory, "RoyaltyRecord.territory", 16);
        this.units = normalizePositiveInteger(input.units, "RoyaltyRecord.units");
        if (!Number.isFinite(input.revenue) || input.revenue < 0) {
            throw new DomainInvariantError("RoyaltyRecord.revenue must be non-negative", { revenue: input.revenue });
        }
        this.revenue = input.revenue;
        this.currency = normalizeToken(input.currency, "RoyaltyRecord.currency", 3, 3).toUpperCase();
        this.source = normalizeToken(input.source, "RoyaltyRecord.source", 1, 128);
        this.importedAt = input.importedAt ?? new Date().toISOString();
        this.metadata = freeze({ ...(input.metadata ?? {}) });
        freeze(this);
    }
}
export class PaymentRecord {
    paymentReference;
    royaltyBatchId;
    amount;
    currency;
    status;
    processedAt;
    statementReference;
    metadata;
    constructor(input) {
        this.paymentReference = input.paymentReference;
        this.royaltyBatchId = input.royaltyBatchId;
        if (!Number.isFinite(input.amount) || input.amount < 0) {
            throw new DomainInvariantError("PaymentRecord.amount must be non-negative", { amount: input.amount });
        }
        this.amount = input.amount;
        this.currency = normalizeToken(input.currency, "PaymentRecord.currency", 3, 3).toUpperCase();
        this.status = input.status ?? "PENDING";
        this.processedAt = normalizeOptionalText(input.processedAt, "PaymentRecord.processedAt", 32);
        this.statementReference = normalizeOptionalText(input.statementReference, "PaymentRecord.statementReference", 128);
        this.metadata = freeze({ ...(input.metadata ?? {}) });
        freeze(this);
    }
}
