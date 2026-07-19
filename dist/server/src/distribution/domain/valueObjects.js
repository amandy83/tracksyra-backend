import { DomainInvariantError } from "./domainErrors.js";
import { freeze, normalizeOptionalText, normalizePositiveInteger, normalizeToken, normalizePercentage } from "./domainHelpers.js";
export class ReleaseId {
    value;
    constructor(value) {
        this.value = normalizeToken(value, "ReleaseId");
        freeze(this);
    }
    toString() { return this.value; }
}
export class DistributionJobId {
    value;
    constructor(value) {
        this.value = normalizeToken(value, "DistributionJobId");
        freeze(this);
    }
    toString() { return this.value; }
}
export class DistributionVersion {
    value;
    constructor(value) {
        this.value = normalizeToken(value, "DistributionVersion", 1, 64);
        freeze(this);
    }
}
export class ReleaseVersion {
    value;
    constructor(value) {
        this.value = normalizeToken(value, "ReleaseVersion", 1, 64);
        freeze(this);
    }
}
export class SnapshotId {
    value;
    constructor(value) {
        this.value = normalizeToken(value, "SnapshotId");
        freeze(this);
    }
}
export class RoyaltyBatchId {
    value;
    constructor(value) {
        this.value = normalizeToken(value, "RoyaltyBatchId");
        freeze(this);
    }
}
export class PaymentReference {
    value;
    constructor(value) {
        this.value = normalizeToken(value, "PaymentReference", 1, 128);
        freeze(this);
    }
}
export class AuditReference {
    value;
    constructor(value) {
        this.value = normalizeToken(value, "AuditReference", 1, 128);
        freeze(this);
    }
}
export class ManifestChecksum {
    value;
    constructor(value) {
        const normalized = value.trim().toLowerCase();
        if (!/^[a-f0-9]{64}$/.test(normalized)) {
            throw new DomainInvariantError("ManifestChecksum must be a SHA-256 hex digest", { value });
        }
        this.value = normalized;
        freeze(this);
    }
}
export class PackageFingerprint {
    value;
    constructor(value) {
        const normalized = value.trim().toLowerCase();
        if (!/^[a-f0-9]{64}$/.test(normalized)) {
            throw new DomainInvariantError("PackageFingerprint must be a SHA-256 hex digest", { value });
        }
        this.value = normalized;
        freeze(this);
    }
}
export class ProviderReference {
    value;
    constructor(value) {
        this.value = normalizeToken(value, "ProviderReference", 1, 128);
        freeze(this);
    }
}
export class ProviderStatus {
    value;
    constructor(value) {
        this.value = value;
        freeze(this);
    }
    isTerminal() {
        return ["ACCEPTED", "LIVE", "REJECTED", "FAILED", "CANCELLED", "TAKEDOWN_COMPLETED"].includes(this.value);
    }
}
export class ProviderReceipt {
    value;
    constructor(value) {
        this.value = normalizeToken(value, "ProviderReceipt", 1, 128);
        freeze(this);
    }
}
export class SubmissionLock {
    token;
    owner;
    acquiredAt;
    expiresAt;
    constructor(input) {
        this.token = normalizeToken(input.token, "SubmissionLock.token");
        this.owner = normalizeToken(input.owner, "SubmissionLock.owner");
        this.acquiredAt = input.acquiredAt ?? new Date().toISOString();
        this.expiresAt = normalizeOptionalText(input.expiresAt, "SubmissionLock.expiresAt", 64);
        freeze(this);
    }
    isExpired(referenceTime = new Date().toISOString()) {
        return this.expiresAt != null ? this.expiresAt <= referenceTime : false;
    }
}
export class TerritorySet {
    values;
    index;
    constructor(values) {
        const normalized = [...new Set(values.map((value) => value.trim().toUpperCase()).filter(Boolean))];
        if (normalized.some((value) => !/^[A-Z]{2,3}$/.test(value) && value !== "WORLD")) {
            throw new DomainInvariantError("Territory codes must be ISO territory codes or WORLD", { values });
        }
        this.values = freeze(normalized);
        this.index = new Set(normalized);
        freeze(this);
    }
    has(code) {
        return this.index.has(code.trim().toUpperCase());
    }
    isEmpty() {
        return this.values.length === 0;
    }
    union(other) {
        return new TerritorySet([...this.values, ...other.values]);
    }
}
export function normalizeContributorShare(value) {
    return normalizePercentage(value, "splitPercentage");
}
export function normalizeTrackNumber(value) {
    return normalizePositiveInteger(value, "trackNumber");
}
