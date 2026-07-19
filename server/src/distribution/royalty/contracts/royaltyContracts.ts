import type { RoyaltyReport, RoyaltyEntry } from "../reports/royaltyReport";
import type { RoyaltyLedger } from "../ledger/royaltyLedger";
import type { RevenueCalculation } from "../calculation/revenueCalculation";
import type { SettlementBatch } from "../settlement/settlementBatch";
import type { Statement } from "../statements/statement";
import type { Adjustment } from "../adjustments/adjustment";
import type { Hold } from "../holds/hold";
import type { CurrencyRate, CurrencyConverter } from "../currency/currencyRate";
import type { RoyaltyReconciliation } from "../reconciliation/royaltyReconciliation";
import type { RoyaltyMetadata, RoyaltyEventType } from "../types/royaltyTypes";

export interface LedgerBuilder {
  build(report: RoyaltyReport): Promise<RoyaltyLedger> | RoyaltyLedger;
}

export interface RevenueCalculator {
  calculate(ledger: RoyaltyLedger): Promise<RevenueCalculation> | RevenueCalculation;
}

export interface SettlementManager {
  create(calculation: RevenueCalculation): Promise<SettlementBatch> | SettlementBatch;
}

export interface StatementBuilder {
  build(settlement: SettlementBatch): Promise<Statement> | Statement;
}

export interface AdjustmentProvider {
  apply(adjustment: Adjustment): Promise<Adjustment> | Adjustment;
}

export interface HoldManager {
  apply(hold: Hold): Promise<Hold> | Hold;
  release(hold: Hold): Promise<Hold> | Hold;
}

export interface RoyaltyReconciliationService {
  reconcile(ledger: RoyaltyLedger): Promise<RoyaltyReconciliation> | RoyaltyReconciliation;
}

export interface RoyaltyAuditService {
  record(eventType: RoyaltyEventType, metadata: RoyaltyMetadata): Promise<void> | void;
}
