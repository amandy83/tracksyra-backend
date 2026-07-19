import type { RoyaltyEntry, RoyaltyReport } from "../reports/royaltyReport";

export interface RoyaltyNormalizer {
  normalize(report: RoyaltyReport): Promise<RoyaltyReport> | RoyaltyReport;
  normalizeEntry(entry: RoyaltyEntry): Promise<RoyaltyEntry> | RoyaltyEntry;
}

