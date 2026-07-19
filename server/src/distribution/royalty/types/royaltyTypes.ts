export type RoyaltyReportType =
  | "Streaming"
  | "Downloads"
  | "UGC"
  | "Content ID"
  | "Subscription"
  | "Ad-supported"
  | "Mechanical"
  | "Publishing";

export type SettlementStep =
  | "Gross Revenue"
  | "Platform Fees"
  | "Taxes"
  | "Adjustments"
  | "Net Revenue"
  | "Artist Share"
  | "Settlement";

export type RoyaltyEventType =
  | "RoyaltyImported"
  | "LedgerCreated"
  | "RevenueCalculated"
  | "SettlementCreated"
  | "PaymentRequested"
  | "StatementGenerated"
  | "AdjustmentApplied"
  | "HoldApplied";

export type RoyaltyMetadata = Readonly<Record<string, unknown>>;

