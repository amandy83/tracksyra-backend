import { DomainInvariantError } from "./domainErrors";
import { freeze, normalizeOptionalText, normalizePositiveInteger, normalizeToken, normalizePercentage } from "./domainHelpers";

export class ReleaseId {
  readonly value: string;
  constructor(value: string) {
    this.value = normalizeToken(value, "ReleaseId");
    freeze(this);
  }
  toString(): string { return this.value; }
}

export class DistributionJobId {
  readonly value: string;
  constructor(value: string) {
    this.value = normalizeToken(value, "DistributionJobId");
    freeze(this);
  }
  toString(): string { return this.value; }
}

export class DistributionVersion {
  readonly value: string;
  constructor(value: string) {
    this.value = normalizeToken(value, "DistributionVersion", 1, 64);
    freeze(this);
  }
}

export class ReleaseVersion {
  readonly value: string;
  constructor(value: string) {
    this.value = normalizeToken(value, "ReleaseVersion", 1, 64);
    freeze(this);
  }
}

export class SnapshotId {
  readonly value: string;
  constructor(value: string) {
    this.value = normalizeToken(value, "SnapshotId");
    freeze(this);
  }
}

export class RoyaltyBatchId {
  readonly value: string;
  constructor(value: string) {
    this.value = normalizeToken(value, "RoyaltyBatchId");
    freeze(this);
  }
}

export class PaymentReference {
  readonly value: string;
  constructor(value: string) {
    this.value = normalizeToken(value, "PaymentReference", 1, 128);
    freeze(this);
  }
}

export class AuditReference {
  readonly value: string;
  constructor(value: string) {
    this.value = normalizeToken(value, "AuditReference", 1, 128);
    freeze(this);
  }
}

export class ManifestChecksum {
  readonly value: string;
  constructor(value: string) {
    const normalized = value.trim().toLowerCase();
    if (!/^[a-f0-9]{64}$/.test(normalized)) {
      throw new DomainInvariantError("ManifestChecksum must be a SHA-256 hex digest", { value });
    }
    this.value = normalized;
    freeze(this);
  }
}

export class PackageFingerprint {
  readonly value: string;
  constructor(value: string) {
    const normalized = value.trim().toLowerCase();
    if (!/^[a-f0-9]{64}$/.test(normalized)) {
      throw new DomainInvariantError("PackageFingerprint must be a SHA-256 hex digest", { value });
    }
    this.value = normalized;
    freeze(this);
  }
}

export class ProviderReference {
  readonly value: string;
  constructor(value: string) {
    this.value = normalizeToken(value, "ProviderReference", 1, 128);
    freeze(this);
  }
}

export type ProviderStatusValue =
  | "PENDING"
  | "AUTHENTICATING"
  | "UPLOADING"
  | "PROCESSING"
  | "ACCEPTED"
  | "LIVE"
  | "REJECTED"
  | "FAILED"
  | "CANCELLED"
  | "TAKEDOWN_PENDING"
  | "TAKEDOWN_COMPLETED";

export class ProviderStatus {
  readonly value: ProviderStatusValue;
  constructor(value: ProviderStatusValue) {
    this.value = value;
    freeze(this);
  }
  isTerminal(): boolean {
    return ["ACCEPTED", "LIVE", "REJECTED", "FAILED", "CANCELLED", "TAKEDOWN_COMPLETED"].includes(this.value);
  }
}

export class ProviderReceipt {
  readonly value: string;
  constructor(value: string) {
    this.value = normalizeToken(value, "ProviderReceipt", 1, 128);
    freeze(this);
  }
}

export class SubmissionLock {
  readonly token: string;
  readonly owner: string;
  readonly acquiredAt: string;
  readonly expiresAt: string | null;

  constructor(input: { token: string; owner: string; acquiredAt?: string; expiresAt?: string | null }) {
    this.token = normalizeToken(input.token, "SubmissionLock.token");
    this.owner = normalizeToken(input.owner, "SubmissionLock.owner");
    this.acquiredAt = input.acquiredAt ?? new Date().toISOString();
    this.expiresAt = normalizeOptionalText(input.expiresAt, "SubmissionLock.expiresAt", 64);
    freeze(this);
  }

  isExpired(referenceTime = new Date().toISOString()): boolean {
    return this.expiresAt != null ? this.expiresAt <= referenceTime : false;
  }
}

export class TerritorySet {
  readonly values: readonly string[];
  private readonly index: ReadonlySet<string>;

  constructor(values: readonly string[]) {
    const normalized = [...new Set(values.map((value) => value.trim().toUpperCase()).filter(Boolean))];
    if (normalized.some((value) => !/^[A-Z]{2,3}$/.test(value) && value !== "WORLD")) {
      throw new DomainInvariantError("Territory codes must be ISO territory codes or WORLD", { values });
    }
    this.values = freeze(normalized);
    this.index = new Set(normalized);
    freeze(this);
  }

  has(code: string): boolean {
    return this.index.has(code.trim().toUpperCase());
  }

  isEmpty(): boolean {
    return this.values.length === 0;
  }

  union(other: TerritorySet): TerritorySet {
    return new TerritorySet([...this.values, ...other.values]);
  }
}

export function normalizeContributorShare(value: number): number {
  return normalizePercentage(value, "splitPercentage");
}

export function normalizeTrackNumber(value: number): number {
  return normalizePositiveInteger(value, "trackNumber");
}

