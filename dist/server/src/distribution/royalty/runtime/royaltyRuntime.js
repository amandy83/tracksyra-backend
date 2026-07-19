import { AnalyticsSnapshot } from "../../intelligence/snapshots/analyticsSnapshot.js";
import { RoyaltyReport, RoyaltyEntry } from "../reports/royaltyReport.js";
import { RoyaltyLedger } from "../ledger/royaltyLedger.js";
import { RevenueCalculation } from "../calculation/revenueCalculation.js";
import { SettlementBatch } from "../settlement/settlementBatch.js";
import { Statement } from "../statements/statement.js";
import { Hold } from "../holds/hold.js";
import { RoyaltyReconciliation } from "../reconciliation/royaltyReconciliation.js";
import { RoyaltyAudit } from "../audit/royaltyAudit.js";
function nowIso() {
    return new Date().toISOString();
}
function freezeRecord(value) {
    return Object.freeze({ ...value });
}
function trim(value) {
    return value.trim();
}
function ensure(value, field) {
    const normalized = trim(value);
    if (!normalized) {
        throw new Error(`${field} must not be empty`);
    }
    return normalized;
}
function normalizeCurrency(currency) {
    const normalized = ensure(currency, "currency").toUpperCase();
    if (!/^[A-Z]{3}$/.test(normalized)) {
        throw new Error(`Invalid currency: ${currency}`);
    }
    return normalized;
}
function normalizeTerritory(territory) {
    if (territory == null)
        return null;
    const normalized = territory.trim().toUpperCase();
    return normalized || null;
}
function normalizeReportType(type) {
    return type;
}
function sum(values) {
    return values.reduce((total, value) => total + value, 0);
}
export class RoyaltyRegistry {
    records;
    constructor(records) {
        this.records = records;
    }
    register(releaseId, record) {
        this.records.set(ensure(releaseId, "releaseId"), record);
    }
    resolve(releaseId) {
        return this.records.get(ensure(releaseId, "releaseId")) ?? null;
    }
    list() {
        return Object.freeze([...this.records.values()]);
    }
}
export class RoyaltyLifecycleManager {
    stages;
    constructor(stages) {
        this.stages = stages;
    }
    set(releaseId, stage) {
        this.stages.set(ensure(releaseId, "releaseId"), stage);
    }
    get(releaseId) {
        return this.stages.get(ensure(releaseId, "releaseId")) ?? null;
    }
}
export class RoyaltyResolver {
    registry;
    constructor(registry) {
        this.registry = registry;
    }
    resolve(releaseId) {
        return this.registry.resolve(releaseId);
    }
}
export class RoyaltyLogger {
    entries = [];
    log(level, message, context) {
        this.entries.push(Object.freeze({
            level,
            message: ensure(message, "message"),
            context: freezeRecord(context ?? {}),
            recordedAt: nowIso(),
        }));
    }
    debug(message, context) { this.log("debug", message, context); }
    info(message, context) { this.log("info", message, context); }
    warn(message, context) { this.log("warn", message, context); }
    error(message, context) { this.log("error", message, context); }
    list() {
        return Object.freeze([...this.entries]);
    }
}
export class RoyaltyMetrics {
    counters;
    observations;
    constructor(counters, observations) {
        this.counters = counters;
        this.observations = observations;
    }
    increment(metric, value = 1, tags = {}) {
        const key = this.key(metric, tags);
        this.counters.set(key, (this.counters.get(key) ?? 0) + value);
    }
    observe(metric, value, tags = {}) {
        const key = this.key(metric, tags);
        const current = this.observations.get(key) ?? [];
        this.observations.set(key, Object.freeze([...current, value]));
    }
    snapshot() {
        return freezeRecord({
            counters: Object.freeze(Object.fromEntries(this.counters.entries())),
            observations: Object.freeze(Object.fromEntries(this.observations.entries())),
        });
    }
    key(metric, tags) {
        return `${ensure(metric, "metric")}:${JSON.stringify(tags)}`;
    }
}
export class RoyaltyHealthChecker {
    healthy(registry) {
        return registry.list().length > 0;
    }
}
export class DuplicateDetection {
    seen = new Set();
    isDuplicate(report) {
        const key = `${report.connectorId}:${report.reportId}:${report.releaseId}`;
        if (this.seen.has(key))
            return true;
        this.seen.add(key);
        return false;
    }
}
export class ConflictResolver {
    resolve(reason, metadata = {}) {
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
export class AuditTrail {
    records = [];
    record(eventType, metadata) {
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
    list() {
        return Object.freeze([...this.records]);
    }
}
export class FinancialHistory {
    ledgers = new Map();
    calculations = new Map();
    settlements = new Map();
    statements = new Map();
    recordLedger(ledger) { this.ledgers.set(ledger.releaseId, ledger); }
    recordCalculation(calculation) { this.calculations.set(calculation.releaseId, calculation); }
    recordSettlement(settlement) { this.settlements.set(settlement.releaseId, settlement); }
    recordStatement(statement) { this.statements.set(statement.releaseId, statement); }
    snapshot() {
        return freezeRecord({
            ledgers: Object.freeze([...this.ledgers.values()]),
            calculations: Object.freeze([...this.calculations.values()]),
            settlements: Object.freeze([...this.settlements.values()]),
            statements: Object.freeze([...this.statements.values()]),
        });
    }
}
export class LedgerManager extends FinancialHistory {
}
export class VersionManager {
    versions = new Map();
    next(releaseId) {
        const key = ensure(releaseId, "releaseId");
        const next = (this.versions.get(key) ?? 0) + 1;
        this.versions.set(key, next);
        return next;
    }
    current(releaseId) {
        return this.versions.get(ensure(releaseId, "releaseId")) ?? 1;
    }
}
export class ReportParser {
    parse(input) {
        if (input instanceof RoyaltyReport) {
            return input;
        }
        const entries = Array.isArray(input.entries) ? input.entries.map((entry) => new RoyaltyEntry({
            entryId: String(entry.entryId ?? `${input.reportId}:${Math.random().toString(36).slice(2)}`),
            reportId: String(input.reportId ?? ""),
            releaseId: String(input.releaseId ?? ""),
            reportType: String(entry.reportType ?? input.type ?? "Streaming"),
            units: Number(entry.units ?? 0),
            grossRevenue: Number(entry.grossRevenue ?? 0),
            currency: String(entry.currency ?? input.currency ?? "USD"),
            trackId: typeof entry.trackId === "string" ? entry.trackId : null,
            contributorId: typeof entry.contributorId === "string" ? entry.contributorId : null,
            territory: typeof entry.territory === "string" ? entry.territory : null,
            source: String(entry.source ?? input.connectorId ?? "unknown"),
            metadata: freezeRecord(entry.metadata ?? {}),
        })) : [];
        return new RoyaltyReport({
            reportId: String(input.reportId ?? `report:${nowIso()}`),
            connectorId: String(input.connectorId ?? "unknown"),
            releaseId: String(input.releaseId ?? ""),
            type: normalizeReportType(String(input.type ?? "Streaming")),
            periodStart: String(input.periodStart ?? nowIso()),
            periodEnd: String(input.periodEnd ?? nowIso()),
            currency: normalizeCurrency(String(input.currency ?? "USD")),
            grossRevenue: Number(input.grossRevenue ?? sum(entries.map((entry) => entry.grossRevenue))),
            entries,
            importedAt: typeof input.importedAt === "string" ? input.importedAt : nowIso(),
            metadata: freezeRecord(input.metadata ?? {}),
        });
    }
}
export class ReportNormalizer {
    currencyNormalizer;
    territoryNormalizer;
    productNormalizer;
    constructor(currencyNormalizer, territoryNormalizer, productNormalizer) {
        this.currencyNormalizer = currencyNormalizer;
        this.territoryNormalizer = territoryNormalizer;
        this.productNormalizer = productNormalizer;
    }
    normalize(report) {
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
    normalize(currency) {
        return normalizeCurrency(currency);
    }
}
export class TerritoryNormalizer {
    normalize(territory) {
        return normalizeTerritory(territory);
    }
}
export class ProductNormalizer {
    normalize(product) {
        return ensure(product, "product");
    }
    normalizeType(type) {
        return normalizeReportType(type);
    }
}
export class CurrencyConversionEngine {
    provider;
    constructor(provider) {
        this.provider = provider;
    }
    async convert(amount, from, to, at) {
        const rate = await Promise.resolve(this.provider.resolveRate(from, to, at));
        if (typeof rate === "number") {
            return amount * rate;
        }
        return amount * rate.rate;
    }
}
export class DefaultExchangeRateProvider {
    rates;
    constructor(rates) {
        this.rates = rates;
    }
    set(rate) {
        this.rates.set(`${rate.baseCurrency}:${rate.quoteCurrency}`, rate);
    }
    resolveRate(baseCurrency, quoteCurrency) {
        const key = `${normalizeCurrency(baseCurrency)}:${normalizeCurrency(quoteCurrency)}`;
        return this.rates.get(key) ?? 1;
    }
}
export class DefaultTaxCalculator {
    calculate(input) {
        const baseRate = input.reportType === "Mechanical" || input.reportType === "Publishing" ? 0.15 : 0.1;
        return Number((input.grossRevenue * baseRate).toFixed(2));
    }
}
export class LedgerBuilder {
    versionManager;
    constructor(versionManager) {
        this.versionManager = versionManager;
    }
    build(report) {
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
export class RevenueCalculator {
    taxCalculator;
    currencyConverter;
    constructor(taxCalculator, currencyConverter) {
        this.taxCalculator = taxCalculator;
        this.currencyConverter = currencyConverter;
    }
    calculate(ledger) {
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
    allocate(calculation) {
        return freezeRecord({
            artist: calculation.artistShare,
            platform: Number((calculation.netRevenue - calculation.artistShare).toFixed(2)),
            taxes: calculation.taxes,
            fees: calculation.platformFees,
        });
    }
}
export class SettlementManager {
    create(calculation) {
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
                steps: ["Gross Revenue", "Platform Fees", "Taxes", "Adjustments", "Net Revenue", "Artist Share", "Settlement"],
            }),
        });
    }
}
export class HoldManager {
    holds;
    constructor(holds) {
        this.holds = holds;
    }
    apply(hold) {
        this.holds.set(hold.holdId, hold);
        return hold;
    }
    release(hold) {
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
    list() {
        return Object.freeze([...this.holds.values()]);
    }
}
export class AdjustmentManager {
    adjustments;
    constructor(adjustments) {
        this.adjustments = adjustments;
    }
    apply(adjustment) {
        this.adjustments.set(adjustment.adjustmentId, adjustment);
        return adjustment;
    }
    list() {
        return Object.freeze([...this.adjustments.values()]);
    }
}
export class StatementGenerator {
    build(settlement) {
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
export class RoyaltyReconciliationEngine {
    duplicateDetection;
    conflictResolver;
    constructor(duplicateDetection, conflictResolver) {
        this.duplicateDetection = duplicateDetection;
        this.conflictResolver = conflictResolver;
    }
    reconcile(ledger) {
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
export class ReportImportManager {
    registry;
    lifecycle;
    parser;
    normalizer;
    ledgerBuilder;
    revenueCalculator;
    settlementManager;
    statementGenerator;
    reconciliationEngine;
    auditTrail;
    financialHistory;
    logger;
    metrics;
    publisher;
    constructor(registry, lifecycle, parser, normalizer, ledgerBuilder, revenueCalculator, settlementManager, statementGenerator, reconciliationEngine, auditTrail, financialHistory, logger, metrics, publisher) {
        this.registry = registry;
        this.lifecycle = lifecycle;
        this.parser = parser;
        this.normalizer = normalizer;
        this.ledgerBuilder = ledgerBuilder;
        this.revenueCalculator = revenueCalculator;
        this.settlementManager = settlementManager;
        this.statementGenerator = statementGenerator;
        this.reconciliationEngine = reconciliationEngine;
        this.auditTrail = auditTrail;
        this.financialHistory = financialHistory;
        this.logger = logger;
        this.metrics = metrics;
        this.publisher = publisher;
    }
    importReport(report) {
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
    process(report) {
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
    manager;
    constructor(manager) {
        this.manager = manager;
    }
    import(reports) {
        return Object.freeze(reports.map((report) => this.manager.importReport(report)));
    }
}
export class IncrementalImport {
    manager;
    constructor(manager) {
        this.manager = manager;
    }
    import(report) {
        return this.manager.importReport(report);
    }
}
export class ScheduledImport extends IncrementalImport {
}
export class ManualImport extends IncrementalImport {
}
export class RetryImport extends IncrementalImport {
}
export class ImportRecovery {
    registry;
    manager;
    constructor(registry, manager) {
        this.registry = registry;
        this.manager = manager;
    }
    recover(releaseId) {
        const record = this.registry.resolve(releaseId);
        return record?.report ? this.manager.importReport(record.report) : null;
    }
}
export class ArtistStatements {
    build(releaseId, registry) {
        return registry.resolve(releaseId)?.statement ?? null;
    }
}
export class LabelStatements {
    build(releaseId, registry) {
        return registry.resolve(releaseId)?.statement ?? null;
    }
}
export class DistributorReports {
    build(releaseId, registry) {
        return registry.resolve(releaseId)?.ledger ?? null;
    }
}
export class RevenueDashboard {
    snapshots;
    constructor(snapshots) {
        this.snapshots = snapshots;
    }
    update(record) {
        this.snapshots.set(record.report?.releaseId ?? record.ledger?.releaseId ?? record.statement?.releaseId ?? "unknown", freezeRecord({
            releaseId: record.report?.releaseId ?? record.ledger?.releaseId ?? record.statement?.releaseId ?? "unknown",
            grossRevenue: record.ledger?.grossRevenue ?? 0,
            netRevenue: record.calculation?.netRevenue ?? 0,
            artistShare: record.calculation?.artistShare ?? 0,
            stage: record.stage,
            updatedAt: record.updatedAt,
        }));
    }
    resolve(releaseId) {
        return this.snapshots.get(ensure(releaseId, "releaseId")) ?? null;
    }
}
export class AnalyticsPublisher {
    published = [];
    publish(record) {
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
            },
            generatedAt: nowIso(),
            metadata: freezeRecord({
                stage: record.stage,
                statementId: record.statement?.statementId ?? null,
            }),
        }));
    }
    list() {
        return Object.freeze([...this.published]);
    }
}
export class RoyaltyCoordinator {
    engine;
    constructor(engine) {
        this.engine = engine;
    }
    importReport(report) {
        return this.engine.importReport(report);
    }
}
export class RoyaltyRuntimeEngine {
    dependencies;
    constructor(dependencies) {
        this.dependencies = dependencies;
    }
    get registry() { return this.dependencies.registry; }
    get lifecycle() { return this.dependencies.lifecycle; }
    get resolver() { return this.dependencies.resolver; }
    importReport(report) {
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
    reconcile(releaseId) {
        const record = this.dependencies.registry.resolve(releaseId);
        return record?.ledger ? this.dependencies.reconciliationEngine.reconcile(record.ledger) : null;
    }
    buildRecord(report) {
        const ledger = this.dependencies.ledgerBuilder.build(report);
        const calculation = this.dependencies.revenueCalculator.calculate(ledger);
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
