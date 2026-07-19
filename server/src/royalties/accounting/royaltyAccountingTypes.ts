import type { RoyaltySplit, RoyaltyRecord } from "../models/royaltyTypes";

export type CurrencyCode = string;

export type RoyaltyTransactionKind =
  | "STREAMING"
  | "DOWNLOAD"
  | "PUBLISHING"
  | "NEIGHBORING_RIGHTS"
  | "MECHANICAL"
  | "PERFORMANCE"
  | "LABEL"
  | "ARTIST"
  | "PRODUCER"
  | "WRITER"
  | "COMPOSER"
  | "ADJUSTMENT"
  | "CHARGEBACK"
  | "RESERVE"
  | "RECOUPMENT"
  | "ADVANCE"
  | "TAX"
  | "PAYMENT";

export type RoyaltyLedgerDirection = "debit" | "credit";

export type RoyaltyMoney = {
  amount: string;
  currency: CurrencyCode;
};

export type RoyaltySplitInput = Pick<RoyaltySplit, "track_id" | "user_id" | "percentage_share"> & {
  role?: string | null;
  walletId?: string | null;
};

export type RoyaltySplitLine = RoyaltySplitInput & RoyaltyMoney & {
  basisPoints: string;
};

export type RoyaltyTaxInput = {
  payeeId: string;
  amount: string;
  currency: CurrencyCode;
  jurisdiction?: string | null;
  withholdingRate?: string | number | null;
  vatRate?: string | number | null;
  gstRate?: string | number | null;
  metadata?: Record<string, unknown>;
};

export type RoyaltyTaxResult = RoyaltyMoney & {
  withholdingAmount: string;
  vatAmount: string;
  gstAmount: string;
  totalTax: string;
  netAmount: string;
  jurisdiction: string | null;
};

export type RoyaltyConversionInput = {
  amount: string;
  fromCurrency: CurrencyCode;
  toCurrency: CurrencyCode;
  exchangeRate?: string | number | null;
  source?: string | null;
  asOf?: string | null;
  metadata?: Record<string, unknown>;
};

export type RoyaltyConversionResult = RoyaltyMoney & {
  exchangeRate: string;
  source: string | null;
  asOf: string | null;
};

export type RoyaltyReserveInput = {
  payeeId: string;
  amount: string;
  currency: CurrencyCode;
  reserveRate?: string | number | null;
  reserveType?: string | null;
  releaseAt?: string | null;
  metadata?: Record<string, unknown>;
};

export type RoyaltyReserveResult = RoyaltyMoney & {
  reserveAmount: string;
  netAmount: string;
  reserveType: string | null;
  releaseAt: string | null;
};

export type RoyaltyAdjustmentInput = {
  payeeId: string;
  amount: string;
  currency: CurrencyCode;
  adjustmentType: string;
  reason?: string | null;
  statementId?: string | null;
  royaltyRecordId?: string | null;
  metadata?: Record<string, unknown>;
};

export type RoyaltyChargebackInput = {
  payeeId: string;
  amount: string;
  currency: CurrencyCode;
  reason: string;
  statementId?: string | null;
  royaltyRecordId?: string | null;
  metadata?: Record<string, unknown>;
};

export type RoyaltyAdvanceInput = {
  payeeId: string;
  amount: string;
  currency: CurrencyCode;
  recoupPercent?: string | number | null;
  metadata?: Record<string, unknown>;
};

export type RoyaltyStatementRequest = {
  payeeId: string;
  payeeType: "artist" | "label" | "publisher" | "writer" | "composer" | "producer" | "admin";
  periodStart: string;
  periodEnd: string;
  currency: CurrencyCode;
  frequency: "monthly" | "quarterly" | "annual";
  format: "pdf" | "csv" | "xlsx";
  statementId?: string | null;
  title?: string | null;
  metadata?: Record<string, unknown>;
};

export type RoyaltyStatementLine = {
  date: string;
  dsp: string;
  releaseTitle?: string | null;
  trackTitle?: string | null;
  units: number;
  grossAmount: string;
  splitPercentage: string;
  netAmount: string;
};

export type RoyaltyStatementResult = {
  statementId: string;
  statementNumber: string;
  versionId: string;
  status: string;
  payeeId: string;
  payeeType: string;
  currency: CurrencyCode;
  periodStart: string;
  periodEnd: string;
  totalGross: string;
  totalNet: string;
  totalTax: string;
  totalReserve: string;
  documents: Array<{ format: "pdf" | "csv" | "xlsx"; fileName: string; mimeType: string; content: Buffer }>;
};

export type RoyaltyCalculationLine = {
  kind: RoyaltyTransactionKind;
  dsp: string;
  trackId?: string | null;
  releaseId?: string | null;
  payeeId: string;
  payeeType: string;
  amount: string;
  currency: CurrencyCode;
  units?: number | null;
  percentageShare?: string | number | null;
  metadata?: Record<string, unknown>;
};

export type RoyaltyCalculationInput = {
  trackId?: string | null;
  releaseId?: string | null;
  periodStart?: string | null;
  periodEnd?: string | null;
  statementId?: string | null;
  currency?: CurrencyCode | null;
  lines: RoyaltyCalculationLine[];
  taxes?: RoyaltyTaxInput[] | null;
  reserve?: Omit<RoyaltyReserveInput, "payeeId" | "amount" | "currency"> & { reserveRate?: string | number | null };
  metadata?: Record<string, unknown>;
};

export type RoyaltyCalculationResult = {
  totalGross: string;
  totalNet: string;
  totalTax: string;
  totalReserve: string;
  transactionIds: string[];
  ledgerIds: string[];
  balanceIds: string[];
  records: RoyaltyRecord[];
};

export type RoyaltyForecastRequest = {
  payeeId?: string | null;
  currency: CurrencyCode;
  periods?: number;
};

export type RoyaltyForecastPoint = {
  period: string;
  projectedRevenue: string;
  confidence: number;
};

export type RoyaltyForecastResult = {
  currency: CurrencyCode;
  periods: RoyaltyForecastPoint[];
  averageRevenue: string;
  trendRate: string;
};

export type RoyaltyReportResult = {
  name: string;
  generatedAt: string;
  currency: CurrencyCode;
  rows: Array<Record<string, unknown>>;
  totals: Record<string, string>;
};

export type RoyaltyAuditResult = {
  status: "healthy" | "degraded";
  tables: string[];
  generatedAt: string;
  details: string[];
};
