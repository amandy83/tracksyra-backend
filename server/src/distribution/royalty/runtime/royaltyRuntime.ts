import { AnalyticsSnapshot } from "../../intelligence/snapshots/analyticsSnapshot";
import type { DistributionProjection } from "../../intelligence/projection/distributionProjection";
import type { ReleaseProjection } from "../../intelligence/projection/releaseProjection";
import type { DashboardProjection } from "../../intelligence/dashboard/dashboardProjection";
import type { TimelineEntry } from "../../intelligence/timeline/timelineEntry";
import type { ProjectionResult } from "../../intelligence/contracts/projectionContracts";
import { AuditRecord } from "../../intelligence/audit/auditRecord";
import { RoyaltyReport, RoyaltyEntry } from "../reports/royaltyReport";
import { RoyaltyLedger } from "../ledger/royaltyLedger";
import { RevenueCalculation } from "../calculation/revenueCalculation";
import { SettlementBatch } from "../settlement/settlementBatch";
import { Statement } from "../statements/statement";
import { Adjustment } from "../adjustments/adjustment";
import { Hold } from "../holds/hold";
import { CurrencyRate, type CurrencyConverter } from "../currency/currencyRate";
import { RoyaltyReconciliation } from "../reconciliation/royaltyReconciliation";
import { RoyaltyAudit } from "../audit/royaltyAudit";
import type { RoyaltyLogger as RoyaltyLoggerPort } from "../logging/royaltyLogger";
import type { RoyaltyMetrics as RoyaltyMetricsPort } from "../metrics/royaltyMetrics";
import type { RoyaltyMetadata, RoyaltyReportType, RoyaltyEventType, SettlementStep } from "../types/royaltyTypes";
import type { RoyaltyImporter } from "../import/royaltyImporter";
import type { LedgerBuilder as LedgerBuilderPort, RevenueCalculator as RevenueCalculatorPort, SettlementManager as SettlementManagerPort, StatementBuilder as StatementBuilderPort, AdjustmentProvider as AdjustmentProviderPort, HoldManager as HoldManagerPort, RoyaltyReconciliationService as RoyaltyReconciliationServicePort, RoyaltyAuditService as RoyaltyAuditServicePort } from "../contracts/royaltyContracts";
import type { RuntimeRepository } from "../../infrastructure/repositories/runtime";

type RuntimeStage =
  | "Imported"
  | "Normalized"
  | "LedgerBuilt"
  | "RevenueCalculated"
  | "Settled"
  | "StatementGenerated"
  | "Reconciled"
  | "Adjusted"
  | "Held"
  | "Recovered"
  | "Failed";

type RuntimeRecord = Readonly<{
  report: RoyaltyReport | null;
  ledger: RoyaltyLedger | null;
  calculation: RevenueCalculation | null;
  settlement: SettlementBatch | null;
  statement: Statement | null;
  reconciliation: RoyaltyReconciliation | null;
  stage: RuntimeStage;
  importedAt: string;
  updatedAt: string;
  metadata: RoyaltyMetadata;
}>;

type RuntimeTags = Readonly<Record<string, string | number | boolean>>;

export type RoyaltyRepositoryBundle = Readonly<{
  records: RuntimeRepository<string, RuntimeRecord>;
  stages: RuntimeRepository<string, RuntimeStage>;
  counters: RuntimeRepository<string, number>;
  observations: RuntimeRepository<string, readonly number[]>;
  rates: RuntimeRepository<string, CurrencyRate | number>;
  holds: RuntimeRepository<string, Hold>;
  adjustments: RuntimeRepository<string, Adjustment>;
  snapshots: RuntimeRepository<string, Readonly<Record<string, unknown>>>;
}>;

export type RoyaltyRuntimeDependencies = Readonly<{
  repositories: RoyaltyRepositoryBundle;
  registry: RoyaltyRegistry;
  lifecycle: RoyaltyLifecycleManager;
  resolver: RoyaltyResolver;
  logger: RoyaltyLogger;
  metrics: RoyaltyMetrics;
  parser: ReportParser;
  normalizer: ReportNormalizer;
  currencyNormalizer: CurrencyNormalizer;
  territoryNormalizer: TerritoryNormalizer;
  productNormalizer: ProductNormalizer;
  ledgerBuilder: LedgerBuilder;
  revenueCalculator: RevenueCalculator;
  settlementManager: SettlementManager;
  statementGenerator: StatementGenerator;
  reconciliationEngine: RoyaltyReconciliationEngine;
  auditTrail: AuditTrail;
  financialHistory: FinancialHistory;
  revenueDashboard: RevenueDashboard;
  analyticsPublisher: AnalyticsPublisher;
}>;

function nowIso(): string {
  return new Date().toISOString();
}

function freezeRecord<T extends Readonly<Record<string, unknown>>>(value: T): T {
  return Object.freeze({ ...value }) as T;
}

function trim(value: string): string {
  return value.trim();
}

function ensure(value: string, field: string): string {
  const normalized = trim(value);
  if (!normalized) {
    throw new Error(`${field} must not be empty`);
  }
  return normalized;
}

function normalizeCurrency(currency: string): string {
  const normalized = ensure(currency, "currency").toUpperCase();
  if (!/^[A-Z]{3}$/.test(normalized)) {
    throw new Error(`Invalid currency: ${currency}`);
  }
  return normalized;
}

function normalizeTerritory(territory: string | null | undefined): string | null {
  if (territory == null) return null;
  const normalized = territory.trim().toUpperCase();
  return normalized || null;
}

function normalizeReportType(type: RoyaltyReportType): RoyaltyReportType {
  return type;
}

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

export interface ExchangeRateProvider {
  resolveRate(baseCurrency: string, quoteCurrency: string, at?: string): Promise<CurrencyRate | number> | CurrencyRate | number;
}

export interface TaxCalculationContract {
  calculate(input: {
    grossRevenue: number;
    currency: string;
    territory?: string | null;
    reportType?: RoyaltyReportType | null;
  }): number;
}

export class RoyaltyRegistry {
  constructor(private readonly records: RoyaltyRepositoryBundle["records"]) {}

  register(releaseId: string, record: RuntimeRecord): void {
    this.records.set(ensure(releaseId, "releaseId"), record);
  }

  resolve(releaseId: string): RuntimeRecord | null {
    return this.records.get(ensure(releaseId, "releaseId")) ?? null;
  }

  list(): readonly RuntimeRecord[] {
    return Object.freeze([...this.records.values()]);
  }
}

export class RoyaltyLifecycleManager {
  constructor(private readonly stages: RoyaltyRepositoryBundle["stages"]) {}

  set(releaseId: string, stage: RuntimeStage): void {
    this.stages.set(ensure(releaseId, "releaseId"), stage);
  }

  get(releaseId: string): RuntimeStage | null {
    return this.stages.get(ensure(releaseId, "releaseId")) ?? null;
  }
}

export class RoyaltyResolver {
  constructor(private readonly registry: RoyaltyRegistry) {}

  resolve(releaseId: string): RuntimeRecord | null {
    return this.registry.resolve(releaseId);
  }
}

export class RoyaltyLogger implements RoyaltyLoggerPort {
  private readonly entries: {
    level: "debug" | "info" | "warn" | "error";
    message: string;
    context: Readonly<Record<string, unknown>>;
    recordedAt: string;
  }[] = [];

  private log(level: "debug" | "info" | "warn" | "error", message: string, context?: Readonly<Record<string, unknown>>): void {
    this.entries.push(Object.freeze({
      level,
      message: ensure(message, "message"),
      context: freezeRecord(context ?? {}),
      recordedAt: nowIso(),
    }));
  }

  debug(message: string, context?: Readonly<Record<string, unknown>>): void { this.log("debug", message, context); }
  info(message: string, context?: Readonly<Record<string, unknown>>): void { this.log("info", message, context); }
  warn(message: string, context?: Readonly<Record<string, unknown>>): void { this.log("warn", message, context); }
  error(message: string, context?: Readonly<Record<string, unknown>>): void { this.log("error", message, context); }

  list(): readonly typeof this.entries[number][] {
    return Object.freeze([...this.entries]);
  }
}

export class RoyaltyMetrics implements RoyaltyMetricsPort {
  constructor(
    private readonly counters: RoyaltyRepositoryBundle["counters"],
    private readonly observations: RoyaltyRepositoryBundle["observations"],
  ) {}

  increment(metric: string, value = 1, tags: RuntimeTags = {}): void {
    const key = this.key(metric, tags);
    this.counters.set(key, (this.counters.get(key) ?? 0) + value);
  }

  observe(metric: string, value: number, tags: RuntimeTags = {}): void {
    const key = this.key(metric, tags);
    const current = this.observations.get(key) ?? [];
    this.observations.set(key, Object.freeze([...current, value]));
  }

  snapshot(): Readonly<Record<string, unknown>> {
    return freezeRecord({
      counters: Object.freeze(Object.fromEntries(this.counters.entries())),
      observations: Object.freeze(Object.fromEntries(this.observations.entries())),
    });
  }

  private key(metric: string, tags: RuntimeTags): string {
    return `${ensure(metric, "metric")}:${JSON.stringify(tags)}`;
  }
}

export class RoyaltyHealthChecker {
  healthy(registry: RoyaltyRegistry): boolean {
    return registry.list().length > 0;
  }
}

export class DuplicateDetection {
  private readonly seen = new Set<string>();

  isDuplicate(report: RoyaltyReport): boolean {
    const key = `${report.connectorId}:${report.reportId}:${report.releaseId}`;
    if (this.seen.has(key)) return true;
    this.seen.add(key);
    return false;
  }
}

export class ConflictResolver {
  resolve(reason: string, metadata: RoyaltyMetadata = {}): RoyaltyReconciliation {
    return new RoyaltyReconciliation({
      reconciliationId: `conflict:${nowIso()}`,
      ledgerId: `conflict:${nowIso()}`,
      releaseId: String(metadata.releaseId ?? "unknown"),
      balanced: false,
      discrepancies: [ensure(reason, "reason")],
      metadata: freezeRecord({ ...metadata, reason }),
    });
  }
}

export class AuditTrail implements RoyaltyAuditServicePort {
  private readonly records: RoyaltyAudit[] = [];

  record(eventType: RoyaltyEventType, metadata: RoyaltyMetadata): void {
    const releaseId = String(metadata.releaseId ?? metadata.ledgerId ?? metadata.reportId ?? "unknown");
    const audit = new RoyaltyAudit({
      auditId: `audit:${releaseId}:${nowIso()}`,
      releaseId,
      eventType,
      recordedAt: nowIso(),
      metadata: freezeRecord(metadata),
    });
    this.records.push(audit);
  }

  list(): readonly RoyaltyAudit[] {
    return Object.freeze([...this.records]);
  }
}

export class FinancialHistory {
  private readonly ledgers = new Map<string, RoyaltyLedger>();
  private readonly calculations = new Map<string, RevenueCalculation>();
  private readonly settlements = new Map<string, SettlementBatch>();
  private readonly statements = new Map<string, Statement>();

  recordLedger(ledger: RoyaltyLedger): void { this.ledgers.set(ledger.releaseId, ledger); }
  recordCalculation(calculation: RevenueCalculation): void { this.calculations.set(calculation.releaseId, calculation); }
  recordSettlement(settlement: SettlementBatch): void { this.settlements.set(settlement.releaseId, settlement); }
  recordStatement(statement: Statement): void { this.statements.set(statement.releaseId, statement); }

  snapshot(): Readonly<Record<string, unknown>> {
    return freezeRecord({
      ledgers: Object.freeze([...this.ledgers.values()]),
      calculations: Object.freeze([...this.calculations.values()]),
      settlements: Object.freeze([...this.settlements.values()]),
      statements: Object.freeze([...this.statements.values()]),
    });
  }
}

export class LedgerManager extends FinancialHistory {}

export class VersionManager {
  private readonly versions = new Map<string, number>();

  next(releaseId: string): number {
    const key = ensure(releaseId, "releaseId");
    const next = (this.versions.get(key) ?? 0) + 1;
    this.versions.set(key, next);
    return next;
  }

  current(releaseId: string): number {
    return this.versions.get(ensure(releaseId, "releaseId")) ?? 1;
  }
}

export class ReportParser {
  parse(input: RoyaltyReport | Readonly<Record<string, unknown>>): RoyaltyReport {
    if (input instanceof RoyaltyReport) {
      return input;
    }
    const entries = Array.isArray(input.entries) ? input.entries.map((entry) => new RoyaltyEntry({
      entryId: String(entry.entryId ?? `${input.reportId}:${Math.random().toString(36).slice(2)}`),
      reportId: String(input.reportId ?? ""),
      releaseId: String(input.releaseId ?? ""),
      reportType: (String(entry.reportType ?? input.type ?? "Streaming") as RoyaltyReportType),
      units: Number(entry.units ?? 0),
      grossRevenue: Number(entry.grossRevenue ?? 0),
      currency: String(entry.currency ?? input.currency ?? "USD"),
      trackId: typeof entry.trackId === "string" ? entry.trackId : null,
      contributorId: typeof entry.contributorId === "string" ? entry.contributorId : null,
      territory: typeof entry.territory === "string" ? entry.territory : null,
      source: String(entry.source ?? input.connectorId ?? "unknown"),
      metadata: freezeRecord((entry.metadata as Readonly<Record<string, unknown>>) ?? {}),
    })) : [];

    return new RoyaltyReport({
      reportId: String(input.reportId ?? `report:${nowIso()}`),
      connectorId: String(input.connectorId ?? "unknown"),
      releaseId: String(input.releaseId ?? ""),
      type: normalizeReportType((String(input.type ?? "Streaming") as RoyaltyReportType)),
      periodStart: String(input.periodStart ?? nowIso()),
      periodEnd: String(input.periodEnd ?? nowIso()),
      currency: normalizeCurrency(String(input.currency ?? "USD")),
      grossRevenue: Number(input.grossRevenue ?? sum(entries.map((entry) => entry.grossRevenue))),
      entries,
      importedAt: typeof input.importedAt === "string" ? input.importedAt : nowIso(),
      metadata: freezeRecord((input.metadata as Readonly<Record<string, unknown>>) ?? {}),
    });
  }
}

export class ReportNormalizer {
  constructor(
    private readonly currencyNormalizer: CurrencyNormalizer,
    private readonly territoryNormalizer: TerritoryNormalizer,
    private readonly productNormalizer: ProductNormalizer,
  ) {}

  normalize(report: RoyaltyReport): RoyaltyReport {
    const entries = report.entries.map((entry) => new RoyaltyEntry({
      entryId: entry.entryId,
      reportId: entry.reportId,
      releaseId: entry.releaseId,
      reportType: entry.reportType,
      units: entry.units,
      grossRevenue: entry.grossRevenue,
      currency: this.currencyNormalizer.normalize(entry.currency),
      trackId: entry.trackId,
      contributorId: entry.contributorId,
      territory: this.territoryNormalizer.normalize(entry.territory),
      source: this.productNormalizer.normalize(entry.source),
      metadata: freezeRecord({ ...entry.metadata, normalized: true }),
    }));

    return new RoyaltyReport({
      reportId: report.reportId,
      connectorId: report.connectorId,
      releaseId: report.releaseId,
      type: this.productNormalizer.normalizeType(report.type),
      periodStart: report.periodStart,
      periodEnd: report.periodEnd,
      currency: this.currencyNormalizer.normalize(report.currency),
      grossRevenue: report.grossRevenue,
      entries,
      importedAt: report.importedAt,
      metadata: freezeRecord({ ...report.metadata, normalized: true }),
    });
  }
}

export class CurrencyNormalizer {
  normalize(currency: string): string {
    return normalizeCurrency(currency);
  }
}

export class TerritoryNormalizer {
  normalize(territory: string | null): string | null {
    return normalizeTerritory(territory);
  }
}

export class ProductNormalizer {
  normalize(product: string): string {
    return ensure(product, "product");
  }

  normalizeType(type: RoyaltyReportType): RoyaltyReportType {
    return normalizeReportType(type);
  }
}

export class CurrencyConversionEngine {
  constructor(private readonly provider: ExchangeRateProvider) {}

  async convert(amount: number, from: string, to: string, at?: string): Promise<number> {
    const rate = await Promise.resolve(this.provider.resolveRate(from, to, at));
    if (typeof rate === "number") {
      return amount * rate;
    }
    return amount * rate.rate;
  }
}

export class DefaultExchangeRateProvider implements ExchangeRateProvider {
  constructor(private readonly rates: RoyaltyRepositoryBundle["rates"]) {}

  set(rate: CurrencyRate): void {
    this.rates.set(`${rate.baseCurrency}:${rate.quoteCurrency}`, rate);
  }

  resolveRate(baseCurrency: string, quoteCurrency: string): CurrencyRate | number {
    const key = `${normalizeCurrency(baseCurrency)}:${normalizeCurrency(quoteCurrency)}`;
    return this.rates.get(key) ?? 1;
  }
}

export class DefaultTaxCalculator implements TaxCalculationContract {
  calculate(input: { grossRevenue: number; currency: string; territory?: string | null; reportType?: RoyaltyReportType | null; }): number {
    const baseRate = input.reportType === "Mechanical" || input.reportType === "Publishing" ? 0.15 : 0.1;
    return Number((input.grossRevenue * baseRate).toFixed(2));
  }
}

export class LedgerBuilder implements LedgerBuilderPort {
  constructor(private readonly versionManager: VersionManager) {}

  build(report: RoyaltyReport): RoyaltyLedger {
    return new RoyaltyLedger({
      ledgerId: `ledger:${report.reportId}:${this.versionManager.next(report.releaseId)}`,
      releaseId: report.releaseId,
      connectorId: report.connectorId,
      currency: report.currency,
      entries: report.entries,
      grossRevenue: report.grossRevenue,
      netRevenue: report.grossRevenue,
      version: this.versionManager.current(report.releaseId),
      metadata: freezeRecord({ reportId: report.reportId, importedAt: report.importedAt }),
    });
  }
}

export class RevenueCalculator implements RevenueCalculatorPort {
  constructor(
    private readonly taxCalculator: TaxCalculationContract,
    private readonly currencyConverter: CurrencyConversionEngine,
  ) {}

  calculate(ledger: RoyaltyLedger): RevenueCalculation {
    const platformFees = Number((ledger.grossRevenue * 0.1).toFixed(2));
    const taxes = Number(this.taxCalculator.calculate({
      grossRevenue: ledger.grossRevenue,
      currency: ledger.currency,
      reportType: null,
    }).toFixed(2));
    const adjustments = 0;
    const netRevenue = Number((ledger.grossRevenue - platformFees - taxes + adjustments).toFixed(2));
    const artistShare = Number((netRevenue * 0.7).toFixed(2));
    return new RevenueCalculation({
      calculationId: `calc:${ledger.ledgerId}`,
      ledgerId: ledger.ledgerId,
      releaseId: ledger.releaseId,
      grossRevenue: ledger.grossRevenue,
      platformFees,
      taxes,
      adjustments,
      netRevenue,
      artistShare,
      currency: ledger.currency,
      metadata: freezeRecord({
        entries: ledger.entries.length,
        connectorId: ledger.connectorId,
      }),
    });
  }
}

export class RevenueAllocator {
  allocate(calculation: RevenueCalculation): Readonly<Record<string, number>> {
    return freezeRecord({
      artist: calculation.artistShare,
      platform: Number((calculation.netRevenue - calculation.artistShare).toFixed(2)),
      taxes: calculation.taxes,
      fees: calculation.platformFees,
    });
  }
}

export class SettlementManager implements SettlementManagerPort {
  create(calculation: RevenueCalculation): SettlementBatch {
    return new SettlementBatch({
      settlementId: `settlement:${calculation.calculationId}`,
      releaseId: calculation.releaseId,
      ledgerId: calculation.ledgerId,
      calculation,
      currency: calculation.currency,
      netRevenue: calculation.netRevenue,
      artistShare: calculation.artistShare,
      metadata: freezeRecord({
        calculationId: calculation.calculationId,
        steps: ["Gross Revenue", "Platform Fees", "Taxes", "Adjustments", "Net Revenue", "Artist Share", "Settlement"] satisfies readonly SettlementStep[],
      }),
    });
  }
}

export class HoldManager implements HoldManagerPort {
  constructor(private readonly holds: RoyaltyRepositoryBundle["holds"]) {}

  apply(hold: Hold): Hold {
    this.holds.set(hold.holdId, hold);
    return hold;
  }

  release(hold: Hold): Hold {
    const released = new Hold({
      holdId: hold.holdId,
      releaseId: hold.releaseId,
      reason: hold.reason,
      active: false,
      appliedAt: hold.appliedAt,
      releasedAt: nowIso(),
      metadata: freezeRecord({ ...hold.metadata, released: true }),
    });
    this.holds.set(hold.holdId, released);
    return released;
  }

  list(): readonly Hold[] {
    return Object.freeze([...this.holds.values()]);
  }
}

export class AdjustmentManager implements AdjustmentProviderPort {
  constructor(private readonly adjustments: RoyaltyRepositoryBundle["adjustments"]) {}

  apply(adjustment: Adjustment): Adjustment {
    this.adjustments.set(adjustment.adjustmentId, adjustment);
    return adjustment;
  }

  list(): readonly Adjustment[] {
    return Object.freeze([...this.adjustments.values()]);
  }
}

export class StatementGenerator implements StatementBuilderPort {
  build(settlement: SettlementBatch): Statement {
    return new Statement({
      statementId: `statement:${settlement.settlementId}`,
      releaseId: settlement.releaseId,
      settlementBatch: settlement,
      periodStart: settlement.calculation.calculatedAt,
      periodEnd: nowIso(),
      currency: settlement.currency,
      amount: settlement.artistShare,
      metadata: freezeRecord({
        settlementId: settlement.settlementId,
      }),
    });
  }
}

export class RoyaltyReconciliationEngine implements RoyaltyReconciliationServicePort {
  constructor(private readonly duplicateDetection: DuplicateDetection, private readonly conflictResolver: ConflictResolver) {}

  reconcile(ledger: RoyaltyLedger): RoyaltyReconciliation {
    const balanced = ledger.grossRevenue >= ledger.netRevenue;
    const discrepancies = balanced ? [] : [`grossRevenue(${ledger.grossRevenue}) < netRevenue(${ledger.netRevenue})`];
    if (this.duplicateDetection.isDuplicate(new RoyaltyReport({
      reportId: ledger.ledgerId,
      connectorId: ledger.connectorId ?? "unknown",
      releaseId: ledger.releaseId,
      type: "Streaming",
      periodStart: ledger.createdAt,
      periodEnd: ledger.createdAt,
      currency: ledger.currency,
      grossRevenue: ledger.grossRevenue,
      entries: ledger.entries,
      importedAt: ledger.createdAt,
    }))) {
      discrepancies.push("duplicate ledger");
    }
    return new RoyaltyReconciliation({
      reconciliationId: `recon:${ledger.ledgerId}`,
      ledgerId: ledger.ledgerId,
      releaseId: ledger.releaseId,
      balanced,
      discrepancies,
      metadata: freezeRecord({
        connectorId: ledger.connectorId,
        conflict: discrepancies.length > 0 ? this.conflictResolver.resolve(discrepancies[0] ?? "conflict", { releaseId: ledger.releaseId }) : null,
      }),
    });
  }
}

export class ReportImportManager implements RoyaltyImporter {
  constructor(
    private readonly registry: RoyaltyRegistry,
    private readonly lifecycle: RoyaltyLifecycleManager,
    private readonly parser: ReportParser,
    private readonly normalizer: ReportNormalizer,
    private readonly ledgerBuilder: LedgerBuilder,
    private readonly revenueCalculator: RevenueCalculator,
    private readonly settlementManager: SettlementManager,
    private readonly statementGenerator: StatementGenerator,
    private readonly reconciliationEngine: RoyaltyReconciliationEngine,
    private readonly auditTrail: AuditTrail,
    private readonly financialHistory: FinancialHistory,
    private readonly logger: RoyaltyLoggerPort,
    private readonly metrics: RoyaltyMetricsPort,
    private readonly publisher: AnalyticsPublisher,
  ) {}

  importReport(report: RoyaltyReport): Promise<RoyaltyReport> | RoyaltyReport {
    const parsed = this.parser.parse(report);
    const normalized = this.normalizer.normalize(parsed);
    const record = this.process(normalized);
    this.registry.register(normalized.releaseId, record);
    this.lifecycle.set(normalized.releaseId, "Imported");
    this.auditTrail.record("RoyaltyImported", { releaseId: normalized.releaseId, reportId: normalized.reportId });
    this.metrics.increment("royalty.imports");
    this.logger.info("Royalty report imported", { releaseId: normalized.releaseId, reportId: normalized.reportId });
    this.publisher.publish(record);
    return normalized;
  }

  private process(report: RoyaltyReport): RuntimeRecord {
    const ledger = this.ledgerBuilder.build(report);
    const calculation = this.revenueCalculator.calculate(ledger);
    const settlement = this.settlementManager.create(calculation);
    const statement = this.statementGenerator.build(settlement);
    const reconciliation = this.reconciliationEngine.reconcile(ledger);
    this.financialHistory.recordLedger(ledger);
    this.financialHistory.recordCalculation(calculation);
    this.financialHistory.recordSettlement(settlement);
    this.financialHistory.recordStatement(statement);
    return Object.freeze({
      report,
      ledger,
      calculation,
      settlement,
      statement,
      reconciliation,
      stage: "Imported",
      importedAt: report.importedAt,
      updatedAt: nowIso(),
      metadata: freezeRecord({
        reportId: report.reportId,
        ledgerId: ledger.ledgerId,
        statementId: statement.statementId,
      }),
    });
  }
}

export class BatchImportEngine {
  constructor(private readonly manager: ReportImportManager) {}

  import(reports: readonly RoyaltyReport[]): readonly RoyaltyReport[] {
    return Object.freeze(reports.map((report) => this.manager.importReport(report) as RoyaltyReport));
  }
}

export class IncrementalImport {
  constructor(private readonly manager: ReportImportManager) {}

  import(report: RoyaltyReport): RoyaltyReport {
    return this.manager.importReport(report) as RoyaltyReport;
  }
}

export class ScheduledImport extends IncrementalImport {}
export class ManualImport extends IncrementalImport {}
export class RetryImport extends IncrementalImport {}

export class ImportRecovery {
  constructor(private readonly registry: RoyaltyRegistry, private readonly manager: ReportImportManager) {}

  recover(releaseId: string): RoyaltyReport | null {
    const record = this.registry.resolve(releaseId);
    return record?.report ? this.manager.importReport(record.report) as RoyaltyReport : null;
  }
}

export class ArtistStatements {
  build(releaseId: string, registry: RoyaltyRegistry): Statement | null {
    return registry.resolve(releaseId)?.statement ?? null;
  }
}

export class LabelStatements {
  build(releaseId: string, registry: RoyaltyRegistry): Statement | null {
    return registry.resolve(releaseId)?.statement ?? null;
  }
}

export class DistributorReports {
  build(releaseId: string, registry: RoyaltyRegistry): RoyaltyLedger | null {
    return registry.resolve(releaseId)?.ledger ?? null;
  }
}

export class RevenueDashboard {
  constructor(private readonly snapshots: RoyaltyRepositoryBundle["snapshots"]) {}

  update(record: RuntimeRecord): void {
    this.snapshots.set(record.report?.releaseId ?? record.ledger?.releaseId ?? record.statement?.releaseId ?? "unknown", freezeRecord({
      releaseId: record.report?.releaseId ?? record.ledger?.releaseId ?? record.statement?.releaseId ?? "unknown",
      grossRevenue: record.ledger?.grossRevenue ?? 0,
      netRevenue: record.calculation?.netRevenue ?? 0,
      artistShare: record.calculation?.artistShare ?? 0,
      stage: record.stage,
      updatedAt: record.updatedAt,
    }));
  }

  resolve(releaseId: string): Readonly<Record<string, unknown>> | null {
    return this.snapshots.get(ensure(releaseId, "releaseId")) ?? null;
  }
}

export class AnalyticsPublisher {
  private readonly published: AnalyticsSnapshot[] = [];

  publish(record: RuntimeRecord): void {
    this.published.push(new AnalyticsSnapshot({
      releaseId: record.report?.releaseId ?? record.ledger?.releaseId ?? "unknown",
      metrics: {
        submissionCounts: 1,
        approvalRate: 100,
        distributionSuccessRate: 100,
        dspLatency: 0,
        uploadLatency: 0,
        failureRate: 0,
        retryRate: 0,
        royaltyTotals: record.ledger?.grossRevenue ?? 0,
        paymentTotals: record.calculation?.netRevenue ?? 0,
      } as never,
      generatedAt: nowIso(),
      metadata: freezeRecord({
        stage: record.stage,
        statementId: record.statement?.statementId ?? null,
      }),
    }));
  }

  list(): readonly AnalyticsSnapshot[] {
    return Object.freeze([...this.published]);
  }
}

export class RoyaltyCoordinator {
  constructor(private readonly engine: RoyaltyRuntimeEngine) {}

  importReport(report: RoyaltyReport): Promise<RuntimeRecord> | RuntimeRecord {
    return this.engine.importReport(report);
  }
}

export class RoyaltyRuntimeEngine {
  private readonly dependencies: RoyaltyRuntimeDependencies;

  constructor(dependencies: RoyaltyRuntimeDependencies) {
    this.dependencies = dependencies;
  }

  get registry(): RoyaltyRegistry { return this.dependencies.registry; }
  get lifecycle(): RoyaltyLifecycleManager { return this.dependencies.lifecycle; }
  get resolver(): RoyaltyResolver { return this.dependencies.resolver; }

  importReport(report: RoyaltyReport): RuntimeRecord {
    const normalized = this.dependencies.normalizer.normalize(this.dependencies.parser.parse(report));
    const record = this.buildRecord(normalized);
    this.dependencies.registry.register(normalized.releaseId, record);
    this.dependencies.lifecycle.set(normalized.releaseId, "Imported");
    this.dependencies.auditTrail.record("RoyaltyImported", {
      reportId: normalized.reportId,
      connectorId: normalized.connectorId,
    });
    this.dependencies.metrics.increment("royalty.imports");
    this.dependencies.logger.info("Royalty report processed", {
      releaseId: normalized.releaseId,
      reportId: normalized.reportId,
    });
    this.dependencies.revenueDashboard.update(record);
    this.dependencies.analyticsPublisher.publish(record);
    return record;
  }

  reconcile(releaseId: string): RoyaltyReconciliation | null {
    const record = this.dependencies.registry.resolve(releaseId);
    return record?.ledger ? this.dependencies.reconciliationEngine.reconcile(record.ledger) : null;
  }

  private buildRecord(report: RoyaltyReport): RuntimeRecord {
    const ledger = this.dependencies.ledgerBuilder.build(report);
    const calculation = this.dependencies.revenueCalculator.calculate(ledger) as RevenueCalculation;
    const settlement = this.dependencies.settlementManager.create(calculation);
    const statement = this.dependencies.statementGenerator.build(settlement);
    const reconciliation = this.dependencies.reconciliationEngine.reconcile(ledger);
    this.dependencies.financialHistory.recordLedger(ledger);
    this.dependencies.financialHistory.recordCalculation(calculation);
    this.dependencies.financialHistory.recordSettlement(settlement);
    this.dependencies.financialHistory.recordStatement(statement);
    return Object.freeze({
      report,
      ledger,
      calculation,
      settlement,
      statement,
      reconciliation,
      stage: "Imported",
      importedAt: report.importedAt,
      updatedAt: nowIso(),
      metadata: freezeRecord({
        reportId: report.reportId,
        connectorId: report.connectorId,
        ledgerId: ledger.ledgerId,
        settlementId: settlement.settlementId,
        statementId: statement.statementId,
      }),
    });
  }
}
