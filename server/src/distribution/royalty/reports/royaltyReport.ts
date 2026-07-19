import type { RoyaltyMetadata, RoyaltyReportType } from "../types/royaltyTypes";

export class RoyaltyReport {
  readonly reportId: string;
  readonly connectorId: string;
  readonly releaseId: string;
  readonly type: RoyaltyReportType;
  readonly periodStart: string;
  readonly periodEnd: string;
  readonly currency: string;
  readonly grossRevenue: number;
  readonly entries: readonly RoyaltyEntry[];
  readonly importedAt: string;
  readonly metadata: RoyaltyMetadata;

  constructor(input: {
    reportId: string;
    connectorId: string;
    releaseId: string;
    type: RoyaltyReportType;
    periodStart: string;
    periodEnd: string;
    currency: string;
    grossRevenue: number;
    entries: readonly RoyaltyEntry[];
    importedAt?: string;
    metadata?: RoyaltyMetadata;
  }) {
    this.reportId = input.reportId.trim();
    this.connectorId = input.connectorId.trim();
    this.releaseId = input.releaseId.trim();
    this.type = input.type;
    this.periodStart = input.periodStart.trim();
    this.periodEnd = input.periodEnd.trim();
    this.currency = input.currency.trim().toUpperCase();
    this.grossRevenue = input.grossRevenue;
    this.entries = Object.freeze([...(input.entries ?? [])]);
    this.importedAt = input.importedAt ?? new Date().toISOString();
    this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
    if (!this.reportId || !this.connectorId || !this.releaseId || !this.periodStart || !this.periodEnd || !this.currency) {
      throw new Error("RoyaltyReport requires non-empty identifiers and currency");
    }
    if (!Number.isFinite(this.grossRevenue) || this.grossRevenue < 0) {
      throw new Error("RoyaltyReport.grossRevenue must be non-negative");
    }
    Object.freeze(this);
  }
}

export class RoyaltyEntry {
  readonly entryId: string;
  readonly reportId: string;
  readonly releaseId: string;
  readonly trackId: string | null;
  readonly contributorId: string | null;
  readonly reportType: RoyaltyReportType;
  readonly units: number;
  readonly grossRevenue: number;
  readonly currency: string;
  readonly territory: string | null;
  readonly source: string;
  readonly metadata: RoyaltyMetadata;

  constructor(input: {
    entryId: string;
    reportId: string;
    releaseId: string;
    reportType: RoyaltyReportType;
    units: number;
    grossRevenue: number;
    currency: string;
    trackId?: string | null;
    contributorId?: string | null;
    territory?: string | null;
    source: string;
    metadata?: RoyaltyMetadata;
  }) {
    this.entryId = input.entryId.trim();
    this.reportId = input.reportId.trim();
    this.releaseId = input.releaseId.trim();
    this.trackId = input.trackId ?? null;
    this.contributorId = input.contributorId ?? null;
    this.reportType = input.reportType;
    this.units = input.units;
    this.grossRevenue = input.grossRevenue;
    this.currency = input.currency.trim().toUpperCase();
    this.territory = input.territory ?? null;
    this.source = input.source.trim();
    this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
    if (!this.entryId || !this.reportId || !this.releaseId || !this.source || !this.currency) {
      throw new Error("RoyaltyEntry requires non-empty identifiers and currency");
    }
    if (!Number.isFinite(this.units) || this.units < 0 || !Number.isFinite(this.grossRevenue) || this.grossRevenue < 0) {
      throw new Error("RoyaltyEntry amounts must be non-negative");
    }
    Object.freeze(this);
  }
}

