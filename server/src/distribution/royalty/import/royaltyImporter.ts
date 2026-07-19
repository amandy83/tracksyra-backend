import type { RoyaltyReport } from "../reports/royaltyReport";

export interface RoyaltyImporter {
  importReport(report: RoyaltyReport): Promise<RoyaltyReport> | RoyaltyReport;
}

