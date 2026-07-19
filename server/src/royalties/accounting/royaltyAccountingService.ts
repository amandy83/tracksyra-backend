import { applyBasisPoints, decimalUsdToMicros, microsToDecimalUsd, percentageToBasisPoints } from "../core/money";
import type { RoyaltyStore, SqlExecutor } from "../services/royaltyStore";
import type { PayoutWalletService } from "../../payments/payouts/services/payoutWalletService";
import type { RoyaltyStatementGenerator } from "../statements/statementGenerator";
import type {
  RoyaltyAdjustmentInput,
  RoyaltyAuditResult,
  RoyaltyCalculationInput,
  RoyaltyCalculationResult,
  RoyaltyAdvanceInput,
  RoyaltyChargebackInput,
  RoyaltyConversionInput,
  RoyaltyConversionResult,
  RoyaltyForecastRequest,
  RoyaltyForecastResult,
  RoyaltyReserveInput,
  RoyaltyReserveResult,
  RoyaltyReportResult,
  RoyaltySplitInput,
  RoyaltySplitLine,
  RoyaltyStatementRequest,
  RoyaltyStatementResult,
  RoyaltyTaxInput,
  RoyaltyTaxResult,
  CurrencyCode,
} from "./royaltyAccountingTypes";
import type { RoyaltyRecord } from "../models/royaltyTypes";

export type RoyaltyAccountingServiceDeps = {
  db: SqlExecutor;
  royaltyStore: RoyaltyStore;
  walletService: Pick<PayoutWalletService, "creditRevenue">;
  statementGenerator: RoyaltyStatementGenerator;
  now?: () => Date;
};

export class RoyaltyAccountingService {
  constructor(private readonly deps: RoyaltyAccountingServiceDeps) {}

  async calculateRoyalties(input: RoyaltyCalculationInput): Promise<RoyaltyCalculationResult> {
    const currency = normalizeCurrency(input.currency ?? "USD");
    const totals = { gross: 0n, tax: 0n, reserve: 0n, net: 0n };
    const transactionIds: string[] = [];
    const ledgerIds: string[] = [];
    const balanceIds: string[] = [];
    const records: RoyaltyRecord[] = [];

    for (const line of input.lines) {
      const amountMicros = decimalUsdToMicros(line.amount);
      totals.gross += amountMicros;

      const taxResult = input.taxes?.length
        ? await this.calculateTaxes({
            payeeId: line.payeeId,
            amount: line.amount,
            currency,
            jurisdiction: input.taxes[0]?.jurisdiction ?? null,
            withholdingRate: input.taxes[0]?.withholdingRate ?? null,
            vatRate: input.taxes[0]?.vatRate ?? null,
            gstRate: input.taxes[0]?.gstRate ?? null,
            metadata: line.metadata,
          })
        : await this.calculateTaxes({ payeeId: line.payeeId, amount: line.amount, currency, metadata: line.metadata });

      const reserveResult = input.reserve
        ? await this.applyReserve({
            payeeId: line.payeeId,
            amount: taxResult.netAmount,
            currency,
            reserveRate: input.reserve.reserveRate ?? 0,
            reserveType: input.reserve.reserveType ?? null,
            releaseAt: input.reserve.releaseAt ?? null,
            metadata: line.metadata,
          })
        : { reserveAmount: "0", netAmount: taxResult.netAmount, reserveType: null, releaseAt: null, amount: taxResult.netAmount, currency };

      totals.tax += decimalUsdToMicros(taxResult.totalTax);
      totals.reserve += decimalUsdToMicros(reserveResult.reserveAmount);
      totals.net += decimalUsdToMicros(reserveResult.netAmount);

      const transactionId = await this.insertTransaction({
        kind: line.kind,
        dsp: line.dsp,
        trackId: line.trackId ?? input.trackId ?? null,
        releaseId: line.releaseId ?? input.releaseId ?? null,
        payeeId: line.payeeId,
        payeeType: line.payeeType,
        amount: line.amount,
        currency,
        units: line.units ?? null,
        percentageShare: line.percentageShare ?? null,
        taxAmount: taxResult.totalTax,
        reserveAmount: reserveResult.reserveAmount,
        netAmount: reserveResult.netAmount,
        metadata: { ...(input.metadata ?? {}), ...(line.metadata ?? {}), tax: taxResult, reserve: reserveResult },
      });
      transactionIds.push(transactionId);

      const ledgerId = await this.insertLedgerEntry({
        transactionId,
        payeeId: line.payeeId,
        currency,
        debit: line.amount,
        credit: reserveResult.netAmount,
        direction: "credit",
        metadata: { source: line.kind, dsp: line.dsp },
      });
      ledgerIds.push(ledgerId);

      const wallet = await this.deps.walletService.creditRevenue({
        userId: line.payeeId,
        amount: reserveResult.netAmount,
        royaltyRecordId: transactionId,
        idempotencyKey: `royalty-credit:${transactionId}:${line.payeeId}`,
        metadata: {
          kind: line.kind,
          dsp: line.dsp,
          track_id: line.trackId ?? input.trackId ?? null,
          release_id: line.releaseId ?? input.releaseId ?? null,
          currency,
        },
      });
      balanceIds.push(wallet.id);

      records.push({
        id: transactionId,
        track_id: String(line.trackId ?? input.trackId ?? ""),
        release_id: String(line.releaseId ?? input.releaseId ?? ""),
        platform: String(line.dsp) as never,
        streams_count: line.units ?? 0,
        revenue_per_stream: line.units ? microsToDecimalUsd(decimalUsdToMicros(line.amount) / BigInt(Math.max(line.units, 1))) : "0",
        total_revenue: line.amount,
        artist_id: line.payeeId,
        calculation_key: transactionId,
        metadata: { kind: line.kind, tax: taxResult, reserve: reserveResult },
        created_at: this.now().toISOString(),
      });
    }

    return {
      totalGross: microsToDecimalUsd(totals.gross),
      totalNet: microsToDecimalUsd(totals.net),
      totalTax: microsToDecimalUsd(totals.tax),
      totalReserve: microsToDecimalUsd(totals.reserve),
      transactionIds,
      ledgerIds,
      balanceIds,
      records,
    };
  }

  async calculateSplits(input: {
    amount: string;
    currency: CurrencyCode;
    splits: RoyaltySplitInput[];
    metadata?: Record<string, unknown>;
  }): Promise<{ amount: string; currency: CurrencyCode; lines: RoyaltySplitLine[] }> {
    if (!input.splits.length) throw new Error("At least one split is required");
    const totalBasisPoints = input.splits.reduce((sum, split) => sum + percentageToBasisPoints(split.percentage_share), 0n);
    if (totalBasisPoints !== 10_000n) throw new Error("Royalty splits must total 100%");

    const totalMicros = decimalUsdToMicros(input.amount);
    let allocated = 0n;
    const lines = input.splits.map((split, index) => {
      const basisPoints = percentageToBasisPoints(split.percentage_share);
      const amountMicros = index === input.splits.length - 1
        ? totalMicros - allocated
        : applyBasisPoints(totalMicros, basisPoints);
      allocated += amountMicros;
      return {
        ...split,
        amount: microsToDecimalUsd(amountMicros),
        currency: input.currency,
        basisPoints: basisPoints.toString(),
      };
    });

    return { amount: input.amount, currency: input.currency, lines };
  }

  async calculateTaxes(input: RoyaltyTaxInput): Promise<RoyaltyTaxResult> {
    const withholding = percentageAmount(input.amount, input.withholdingRate ?? 0);
    const vat = percentageAmount(input.amount, input.vatRate ?? 0);
    const gst = percentageAmount(input.amount, input.gstRate ?? 0);
    const totalTaxMicros = decimalUsdToMicros(withholding.amount) + decimalUsdToMicros(vat.amount) + decimalUsdToMicros(gst.amount);
    const netMicros = decimalUsdToMicros(input.amount) - totalTaxMicros;
    const result: RoyaltyTaxResult = {
      amount: input.amount,
      currency: input.currency,
      withholdingAmount: withholding.amount,
      vatAmount: vat.amount,
      gstAmount: gst.amount,
      totalTax: microsToDecimalUsd(totalTaxMicros),
      netAmount: microsToDecimalUsd(netMicros < 0n ? 0n : netMicros),
      jurisdiction: input.jurisdiction ?? null,
    };
    void this.deps.db.query(
      `INSERT INTO public.royalty_taxes (
         tax_id, payee_id, jurisdiction, tax_type, withholding_rate, vat_rate, gst_rate,
         withholding_amount, vat_amount, gst_amount, total_tax, currency, metadata
       ) VALUES (
         gen_random_uuid(), :payeeId, :jurisdiction, 'ROYALTY', :withholdingRate, :vatRate, :gstRate,
         :withholdingAmount, :vatAmount, :gstAmount, :totalTax, :currency, CAST(:metadata AS jsonb)
       )`,
      {
        payeeId: input.payeeId,
        jurisdiction: input.jurisdiction ?? null,
        withholdingRate: normalizeRate(input.withholdingRate),
        vatRate: normalizeRate(input.vatRate),
        gstRate: normalizeRate(input.gstRate),
        withholdingAmount: result.withholdingAmount,
        vatAmount: result.vatAmount,
        gstAmount: result.gstAmount,
        totalTax: result.totalTax,
        currency: input.currency,
        metadata: JSON.stringify(input.metadata ?? {}),
      },
    );
    return result;
  }

  async convertCurrency(input: RoyaltyConversionInput): Promise<RoyaltyConversionResult> {
    const fromCurrency = normalizeCurrency(input.fromCurrency);
    const toCurrency = normalizeCurrency(input.toCurrency);
    const rate = input.exchangeRate ?? (fromCurrency === toCurrency ? 1 : await this.lookupExchangeRate(fromCurrency, toCurrency));
    const converted = multiplyDecimal(input.amount, rate);
    const result: RoyaltyConversionResult = {
      amount: converted,
      currency: toCurrency,
      exchangeRate: normalizeRate(rate),
      source: input.source ?? null,
      asOf: input.asOf ?? this.now().toISOString(),
    };

    void this.deps.db.query(
      `INSERT INTO public.royalty_exchange_rates (
         exchange_rate_id, base_currency, quote_currency, rate, source, as_of_date, effective_at, metadata
       ) VALUES (
         gen_random_uuid(), :baseCurrency, :quoteCurrency, :rate, :source, COALESCE(:asOf, now()), now(), CAST(:metadata AS jsonb)
       )`,
      {
        baseCurrency: fromCurrency,
        quoteCurrency: toCurrency,
        rate: result.exchangeRate,
        source: result.source,
        asOf: result.asOf,
        metadata: JSON.stringify(input.metadata ?? {}),
      },
    );

    return result;
  }

  async applyAdjustment(input: RoyaltyAdjustmentInput) {
    const rows = await this.deps.db.query<{ id: string; amount: string; currency: string }>(
      `INSERT INTO public.royalty_adjustments (
         adjustment_id, payee_id, adjustment_type, amount, currency, reason, statement_id, royalty_record_id, metadata
       ) VALUES (
         gen_random_uuid(), :payeeId, :adjustmentType, :amount, :currency, :reason, :statementId, :royaltyRecordId, CAST(:metadata AS jsonb)
       )
       RETURNING adjustment_id AS id, amount, currency`,
      {
        payeeId: input.payeeId,
        adjustmentType: input.adjustmentType,
        amount: input.amount,
        currency: input.currency,
        reason: input.reason ?? null,
        statementId: input.statementId ?? null,
        royaltyRecordId: input.royaltyRecordId ?? null,
        metadata: JSON.stringify(input.metadata ?? {}),
      },
    );

    await this.insertLedgerEntry({
      transactionId: input.royaltyRecordId ?? rows[0].id,
      payeeId: input.payeeId,
      currency: input.currency,
      debit: input.amount,
      credit: "0",
      direction: "debit",
      metadata: { adjustmentType: input.adjustmentType, reason: input.reason ?? null },
    });

    await this.audit("royalty_adjustments", rows[0].id, "APPLIED", input.metadata ?? {}, input.payeeId);
    return rows[0];
  }

  async applyChargeback(input: RoyaltyChargebackInput) {
    const rows = await this.deps.db.query<{ id: string }>(
      `INSERT INTO public.royalty_chargebacks (
         chargeback_id, payee_id, amount, currency, reason, statement_id, royalty_record_id, metadata
       ) VALUES (
         gen_random_uuid(), :payeeId, :amount, :currency, :reason, :statementId, :royaltyRecordId, CAST(:metadata AS jsonb)
       )
       RETURNING chargeback_id AS id`,
      {
        payeeId: input.payeeId,
        amount: input.amount,
        currency: input.currency,
        reason: input.reason,
        statementId: input.statementId ?? null,
        royaltyRecordId: input.royaltyRecordId ?? null,
        metadata: JSON.stringify(input.metadata ?? {}),
      },
    );
    await this.insertLedgerEntry({
      transactionId: input.royaltyRecordId ?? rows[0].id,
      payeeId: input.payeeId,
      currency: input.currency,
      debit: input.amount,
      credit: "0",
      direction: "debit",
      metadata: { reason: input.reason, type: "CHARGEBACK" },
    });
    await this.audit("royalty_chargebacks", rows[0].id, "APPLIED", input.metadata ?? {}, input.payeeId);
    return rows[0];
  }

  async applyReserve(input: RoyaltyReserveInput): Promise<RoyaltyReserveResult> {
    const reserveAmount = percentageAmount(input.amount, input.reserveRate ?? 0);
    const result: RoyaltyReserveResult = {
      amount: input.amount,
      currency: input.currency,
      reserveAmount: reserveAmount.amount,
      netAmount: microsToDecimalUsd(decimalUsdToMicros(input.amount) - decimalUsdToMicros(reserveAmount.amount)),
      reserveType: input.reserveType ?? null,
      releaseAt: input.releaseAt ?? null,
    };

    await this.deps.db.query(
      `INSERT INTO public.royalty_reserves (
         reserve_id, payee_id, reserve_type, reserve_rate, amount, currency, release_at, status, metadata
       ) VALUES (
         gen_random_uuid(), :payeeId, :reserveType, :reserveRate, :amount, :currency, :releaseAt, 'HELD', CAST(:metadata AS jsonb)
       )`,
      {
        payeeId: input.payeeId,
        reserveType: input.reserveType ?? null,
        reserveRate: normalizeRate(input.reserveRate),
        amount: result.reserveAmount,
        currency: input.currency,
        releaseAt: input.releaseAt ?? null,
        metadata: JSON.stringify(input.metadata ?? {}),
      },
    );
    return result;
  }

  async applyAdvance(input: RoyaltyAdvanceInput) {
    const rows = await this.deps.db.query<{ id: string }>(
      `INSERT INTO public.royalty_advances (
         advance_id, payee_id, amount, currency, recoup_percent, recouped_amount, outstanding_amount, status, metadata
       ) VALUES (
         gen_random_uuid(), :payeeId, :amount, :currency, :recoupPercent, '0', :amount, 'OPEN', CAST(:metadata AS jsonb)
       )
       RETURNING advance_id AS id`,
      {
        payeeId: input.payeeId,
        amount: input.amount,
        currency: input.currency,
        recoupPercent: normalizeRate(input.recoupPercent ?? 0),
        metadata: JSON.stringify(input.metadata ?? {}),
      },
    );
    await this.insertLedgerEntry({
      transactionId: rows[0].id,
      payeeId: input.payeeId,
      currency: input.currency,
      debit: input.amount,
      credit: "0",
      direction: "debit",
      metadata: { type: "ADVANCE" },
    });
    await this.audit("royalty_advances", rows[0].id, "GRANTED", input.metadata ?? {}, input.payeeId);
    return rows[0];
  }

  async applyRecoupment(input: { advanceId: string; payeeId: string; amount: string; currency: CurrencyCode; metadata?: Record<string, unknown> }) {
    const rows = await this.deps.db.query<{ id: string }>(
      `INSERT INTO public.royalty_recoupments (
         recoupment_id, advance_id, payee_id, amount, currency, recouped_at, metadata
       ) VALUES (
         gen_random_uuid(), :advanceId, :payeeId, :amount, :currency, now(), CAST(:metadata AS jsonb)
       )
       RETURNING recoupment_id AS id`,
      {
        advanceId: input.advanceId,
        payeeId: input.payeeId,
        amount: input.amount,
        currency: input.currency,
        metadata: JSON.stringify(input.metadata ?? {}),
      },
    );
    await this.insertLedgerEntry({
      transactionId: rows[0].id,
      payeeId: input.payeeId,
      currency: input.currency,
      debit: input.amount,
      credit: "0",
      direction: "debit",
      metadata: { type: "RECOUPMENT", advanceId: input.advanceId },
    });
    await this.audit("royalty_recoupments", rows[0].id, "RECORDED", input.metadata ?? {}, input.payeeId);
    return rows[0];
  }

  async generateStatement(input: RoyaltyStatementRequest): Promise<RoyaltyStatementResult> {
    const statementId = input.statementId || `stmt_${input.payeeId}_${input.periodStart}_${input.periodEnd}`;
    const summary = await this.statementSummary(input.payeeId, input.periodStart, input.periodEnd, input.currency);
    const versionRows = await this.deps.db.query<{ id: string }>(
      `INSERT INTO public.royalty_statements (
         statement_id, statement_number, payee_id, payee_type, period_start, period_end, currency,
         status, total_gross, total_net, total_tax, total_reserve, title, metadata
       ) VALUES (
         :statementId, :statementNumber, :payeeId, :payeeType, :periodStart, :periodEnd, :currency,
         'DRAFT', :totalGross, :totalNet, :totalTax, :totalReserve, :title, CAST(:metadata AS jsonb)
       )
       ON CONFLICT (statement_id) DO UPDATE SET
         status = EXCLUDED.status,
         total_gross = EXCLUDED.total_gross,
         total_net = EXCLUDED.total_net,
         total_tax = EXCLUDED.total_tax,
         total_reserve = EXCLUDED.total_reserve,
         title = EXCLUDED.title,
         metadata = EXCLUDED.metadata,
         updated_at = now()
       RETURNING statement_id AS id`,
      {
        statementId,
        statementNumber: statementId,
        payeeId: input.payeeId,
        payeeType: input.payeeType,
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        currency: input.currency,
        totalGross: summary.total_gross,
        totalNet: summary.total_net,
        totalTax: summary.total_tax,
        totalReserve: summary.total_reserve,
        title: input.title ?? null,
        metadata: JSON.stringify(input.metadata ?? {}),
      },
    );

    const rows = await this.deps.db.query<{ transaction_date: string; dsp: string; release_title: string | null; track_title: string | null; units: number; gross_amount: string; split_percentage: string; net_amount: string }>(
      `SELECT
         COALESCE(occurred_at, created_at, now())::date AS transaction_date,
         dsp,
         NULL::text AS release_title,
         NULL::text AS track_title,
         COALESCE(units, 0)::int AS units,
         amount AS gross_amount,
         COALESCE(percentage_share, '100') AS split_percentage,
         COALESCE(net_amount, amount) AS net_amount
       FROM public.royalty_transactions
       WHERE payee_id = :payeeId
         AND occurred_at >= :periodStart::timestamptz
         AND occurred_at <= :periodEnd::timestamptz
       ORDER BY occurred_at ASC`,
      { payeeId: input.payeeId, periodStart: input.periodStart, periodEnd: input.periodEnd },
    );

    const lines = rows.map((row) => ({
      date: String(row.transaction_date),
      dsp: row.dsp,
      releaseTitle: row.release_title,
      trackTitle: row.track_title,
      units: Number(row.units || 0),
      grossAmount: String(row.gross_amount),
      splitPercentage: String(row.split_percentage),
      netAmount: String(row.net_amount),
    }));

    const document = this.deps.statementGenerator.generate({
      statementId,
      userName: input.title || input.payeeId,
      frequency: input.frequency,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      currency: input.currency,
      lines,
    }, input.format);

    const versionRowsInserted = await this.deps.db.query<{ id: string }>(
      `INSERT INTO public.royalty_statement_versions (
         statement_version_id, statement_id, version_number, status, document_format, file_name, mime_type, content_hash, generated_at, metadata
       ) VALUES (
         gen_random_uuid(), :statementId, 1, 'GENERATED', :format, :fileName, :mimeType, :contentHash, now(), CAST(:metadata AS jsonb)
       )
       RETURNING statement_version_id AS id`,
      {
        statementId,
        format: document.format,
        fileName: document.fileName,
        mimeType: document.mimeType,
        contentHash: hashBuffer(document.content),
        metadata: JSON.stringify({ ...input.metadata, payeeId: input.payeeId }),
      },
    );

    await this.audit("royalty_statements", statementId, "GENERATED", input.metadata ?? {}, input.payeeId);
    return {
      statementId,
      statementNumber: statementId,
      versionId: versionRowsInserted[0].id,
      status: "DRAFT",
      payeeId: input.payeeId,
      payeeType: input.payeeType,
      currency: input.currency,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      totalGross: summary.total_gross,
      totalNet: summary.total_net,
      totalTax: summary.total_tax,
      totalReserve: summary.total_reserve,
      documents: [document],
    };
  }

  async approveStatement(input: { statementId: string; approverId: string; metadata?: Record<string, unknown> }) {
    await this.deps.db.query(
      `UPDATE public.royalty_statements
       SET status = 'APPROVED', approved_at = now(), updated_at = now()
       WHERE statement_id = :statementId`,
      { statementId: input.statementId },
    );
    await this.audit("royalty_statements", input.statementId, "APPROVED", input.metadata ?? {}, input.approverId);
    return { statementId: input.statementId, status: "APPROVED" };
  }

  async releasePayment(input: { statementId: string; approverId: string; scheduledFor?: string | null; metadata?: Record<string, unknown> }) {
    const statement = await this.deps.db.query<{ payee_id: string; currency: string; total_net: string }>(
      `SELECT payee_id, currency, total_net
       FROM public.royalty_statements
       WHERE statement_id = :statementId
       LIMIT 1`,
      { statementId: input.statementId },
    );
    if (!statement[0]) throw new Error(`Statement not found: ${input.statementId}`);

    const batch = await this.deps.db.query<{ id: string }>(
      `INSERT INTO public.royalty_payout_batches (
         payout_batch_id, batch_number, currency, status, scheduled_for, total_amount, payment_count, metadata
       ) VALUES (
         gen_random_uuid(), :batchNumber, :currency, 'APPROVED', :scheduledFor, :totalAmount, 1, CAST(:metadata AS jsonb)
       )
       RETURNING payout_batch_id AS id`,
      {
        batchNumber: `batch_${input.statementId}`,
        currency: statement[0].currency,
        scheduledFor: input.scheduledFor ?? null,
        totalAmount: statement[0].total_net,
        metadata: JSON.stringify(input.metadata ?? {}),
      },
    );

    await this.deps.db.query(
      `INSERT INTO public.royalty_payments (
         payment_id, payout_batch_id, statement_id, payee_id, amount, currency, status, scheduled_for, approved_at, released_at, metadata
       ) VALUES (
         gen_random_uuid(), :batchId, :statementId, :payeeId, :amount, :currency, 'RELEASED', :scheduledFor, now(), now(), CAST(:metadata AS jsonb)
       )`,
      {
        batchId: batch[0].id,
        statementId: input.statementId,
        payeeId: statement[0].payee_id,
        amount: statement[0].total_net,
        currency: statement[0].currency,
        scheduledFor: input.scheduledFor ?? null,
        metadata: JSON.stringify(input.metadata ?? {}),
      },
    );

    await this.deps.db.query(
      `UPDATE public.royalty_statements
       SET status = 'PAID', released_at = now(), updated_at = now()
       WHERE statement_id = :statementId`,
      { statementId: input.statementId },
    );

    await this.audit("royalty_payments", batch[0].id, "RELEASED", input.metadata ?? {}, input.approverId);
    return { payoutBatchId: batch[0].id, statementId: input.statementId, status: "RELEASED" };
  }

  async generateForecast(input: RoyaltyForecastRequest): Promise<RoyaltyForecastResult> {
    const periods = Math.max(1, Math.min(12, Math.trunc(input.periods ?? 6)));
    const rows = await this.deps.db.query<{ period: string; revenue: string }>(
      `SELECT TO_CHAR(COALESCE(occurred_at, created_at, now()), 'YYYY-MM') AS period,
              SUM(COALESCE(net_amount, amount))::numeric::text AS revenue
       FROM public.royalty_transactions
       WHERE (:payeeId IS NULL OR payee_id = :payeeId)
         AND currency = :currency
       GROUP BY 1
       ORDER BY 1 DESC
       LIMIT 12`,
      { payeeId: input.payeeId ?? null, currency: input.currency },
    );

    const historical = rows.map((row) => Number(row.revenue || 0));
    const average = historical.length ? historical.reduce((sum, value) => sum + value, 0) / historical.length : 0;
    const previous = historical[1] ?? historical[0] ?? average;
    const trendRate = previous > 0 ? (average / previous) - 1 : 0;
    const projected = Array.from({ length: periods }, (_, index) => {
      const factor = Math.max(0.5, 1 + trendRate * (index + 1) * 0.4);
      return {
        period: addMonths(this.now(), index + 1).slice(0, 7),
        projectedRevenue: moneyString(average * factor, input.currency),
        confidence: Math.max(45, Math.min(96, Math.round(88 - index * 3 + historical.length * 2))),
      };
    });

    return {
      currency: input.currency,
      periods: projected,
      averageRevenue: moneyString(average, input.currency),
      trendRate: `${(trendRate * 100).toFixed(2)}%`,
    };
  }

  async generateRevenueReport(input: { currency: CurrencyCode; payeeId?: string | null; periodStart?: string | null; periodEnd?: string | null }): Promise<RoyaltyReportResult> {
    const rows = await this.deps.db.query<Record<string, unknown>>(
      `SELECT dsp, payee_id, COUNT(*)::int AS transactions, SUM(COALESCE(net_amount, amount))::numeric::text AS revenue
       FROM public.royalty_transactions
       WHERE currency = :currency
         AND (:payeeId IS NULL OR payee_id = :payeeId)
       GROUP BY dsp, payee_id
       ORDER BY revenue DESC`,
      { currency: input.currency, payeeId: input.payeeId ?? null },
    );
    return {
      name: "Revenue Report",
      generatedAt: this.now().toISOString(),
      currency: input.currency,
      rows,
      totals: { revenue: rows.reduce((sum, row) => sum + Number(row.revenue || 0), 0).toFixed(2) },
    };
  }

  async generatePaymentReport(input: { currency: CurrencyCode; payeeId?: string | null }): Promise<RoyaltyReportResult> {
    const rows = await this.deps.db.query<Record<string, unknown>>(
      `SELECT pb.batch_number, p.statement_id, p.payee_id, p.amount, p.currency, p.status, p.released_at
       FROM public.royalty_payments p
       JOIN public.royalty_payout_batches pb ON pb.payout_batch_id = p.payout_batch_id
       WHERE p.currency = :currency
         AND (:payeeId IS NULL OR p.payee_id = :payeeId)
       ORDER BY p.released_at DESC NULLS LAST`,
      { currency: input.currency, payeeId: input.payeeId ?? null },
    );
    return {
      name: "Payment Report",
      generatedAt: this.now().toISOString(),
      currency: input.currency,
      rows,
      totals: { amount: rows.reduce((sum, row) => sum + Number(row.amount || 0), 0).toFixed(2) },
    };
  }

  async generateAuditReport(input: { currency: CurrencyCode; payeeId?: string | null }): Promise<RoyaltyReportResult> {
    const rows = await this.deps.db.query<Record<string, unknown>>(
      `SELECT entity_type, entity_id, action, actor, status, payload, created_at
       FROM public.royalty_audit
       WHERE (:payeeId IS NULL OR entity_id = :payeeId)
       ORDER BY created_at DESC`,
      { payeeId: input.payeeId ?? null },
    );
    return {
      name: "Audit Report",
      generatedAt: this.now().toISOString(),
      currency: input.currency,
      rows,
      totals: { events: String(rows.length) },
    };
  }

  async healthCheck(): Promise<RoyaltyAuditResult> {
    const tables = [
      "royalty_transactions",
      "royalty_ledgers",
      "royalty_statements",
      "royalty_statement_versions",
      "royalty_balances",
      "royalty_wallets",
      "royalty_payout_batches",
      "royalty_payments",
      "royalty_adjustments",
      "royalty_chargebacks",
      "royalty_advances",
      "royalty_recoupments",
      "royalty_exchange_rates",
      "royalty_taxes",
      "royalty_reserves",
      "royalty_audit",
    ];

    const details: string[] = [];
    for (const table of tables) {
      try {
        await this.deps.db.query(`SELECT 1 FROM public.${table} LIMIT 1`);
        details.push(`${table}:ok`);
      } catch (error) {
        details.push(`${table}:missing`);
        return { status: "degraded", tables, generatedAt: this.now().toISOString(), details: [...details, error instanceof Error ? error.message : String(error)] };
      }
    }
    return { status: "healthy", tables, generatedAt: this.now().toISOString(), details };
  }

  async retry(input: { queueName: string; jobId?: string | null; reason?: string | null; metadata?: Record<string, unknown> }) {
    await this.audit("royalty_retry", input.jobId ?? input.queueName, "RETRY", { reason: input.reason ?? null, ...(input.metadata ?? {}) }, input.queueName);
    return { status: "QUEUED", queueName: input.queueName, jobId: input.jobId ?? null };
  }

  async getDashboard(input: { currency: CurrencyCode; payeeId?: string | null }) {
    const revenue = await this.generateRevenueReport(input);
    const payments = await this.generatePaymentReport(input);
    const audit = await this.generateAuditReport(input);
    const forecast = await this.generateForecast({ currency: input.currency, payeeId: input.payeeId ?? null, periods: 6 });
    return {
      revenue,
      payments,
      audit,
      forecast,
      summary: {
        revenue: revenue.totals.revenue,
        payments: payments.totals.amount,
        auditEvents: audit.rows.length,
      },
    };
  }

  private async insertTransaction(input: {
    kind: string;
    dsp: string;
    trackId: string | null;
    releaseId: string | null;
    payeeId: string;
    payeeType: string;
    amount: string;
    currency: CurrencyCode;
    units: number | null;
    percentageShare: string | number | null;
    taxAmount: string;
    reserveAmount: string;
    netAmount: string;
    metadata: Record<string, unknown>;
  }) {
    const rows = await this.deps.db.query<{ id: string }>(
      `INSERT INTO public.royalty_transactions (
         transaction_id, transaction_kind, dsp, track_id, release_id, payee_id, payee_type, amount,
         currency, units, percentage_share, tax_amount, reserve_amount, net_amount, occurred_at, metadata
       ) VALUES (
         gen_random_uuid(), :kind, :dsp, :trackId, :releaseId, :payeeId, :payeeType, :amount,
         :currency, :units, :percentageShare, :taxAmount, :reserveAmount, :netAmount, now(), CAST(:metadata AS jsonb)
       )
       RETURNING transaction_id AS id`,
      {
        ...input,
        metadata: JSON.stringify(input.metadata),
      },
    );
    return rows[0].id;
  }

  private async insertLedgerEntry(input: {
    transactionId: string;
    payeeId: string;
    currency: CurrencyCode;
    debit: string;
    credit: string;
    direction: "debit" | "credit";
    metadata: Record<string, unknown>;
  }) {
    const rows = await this.deps.db.query<{ id: string }>(
      `INSERT INTO public.royalty_ledgers (
         ledger_id, transaction_id, payee_id, currency, debit, credit, direction, balance_after, metadata
       ) VALUES (
         gen_random_uuid(), :transactionId, :payeeId, :currency, :debit, :credit, :direction, :credit, CAST(:metadata AS jsonb)
       )
       RETURNING ledger_id AS id`,
      {
        ...input,
        metadata: JSON.stringify(input.metadata),
      },
    );
    return rows[0].id;
  }

  private async statementSummary(payeeId: string, periodStart: string, periodEnd: string, currency: CurrencyCode) {
    const rows = await this.deps.db.query<{ total_gross: string; total_net: string; total_tax: string; total_reserve: string }>(
      `SELECT
         COALESCE(SUM(amount), 0)::numeric::text AS total_gross,
         COALESCE(SUM(COALESCE(net_amount, amount)), 0)::numeric::text AS total_net,
         COALESCE(SUM(COALESCE(tax_amount, 0)), 0)::numeric::text AS total_tax,
         COALESCE(SUM(COALESCE(reserve_amount, 0)), 0)::numeric::text AS total_reserve
       FROM public.royalty_transactions
       WHERE payee_id = :payeeId
         AND currency = :currency
         AND occurred_at >= :periodStart::timestamptz
         AND occurred_at <= :periodEnd::timestamptz`,
      { payeeId, periodStart, periodEnd, currency },
    );
    return rows[0] || { total_gross: "0", total_net: "0", total_tax: "0", total_reserve: "0" };
  }

  private async lookupExchangeRate(baseCurrency: CurrencyCode, quoteCurrency: CurrencyCode) {
    const rows = await this.deps.db.query<{ rate: string }>(
      `SELECT rate
       FROM public.royalty_exchange_rates
       WHERE base_currency = :baseCurrency
         AND quote_currency = :quoteCurrency
       ORDER BY effective_at DESC
       LIMIT 1`,
      { baseCurrency, quoteCurrency },
    );
    return rows[0]?.rate ?? "1";
  }

  private async audit(entityType: string, entityId: string, action: string, payload: Record<string, unknown>, actor: string) {
    void this.deps.db.query(
      `INSERT INTO public.royalty_audit (
         audit_id, entity_type, entity_id, action, actor, status, payload, created_at
       ) VALUES (
         gen_random_uuid(), :entityType, :entityId, :action, :actor, 'RECORDED', CAST(:payload AS jsonb), now()
       )`,
      {
        entityType,
        entityId,
        action,
        actor,
        payload: JSON.stringify(payload),
      },
    );
  }

  private now() {
    return this.deps.now?.() ?? new Date();
  }
}

function normalizeCurrency(value: CurrencyCode) {
  return String(value || "USD").toUpperCase();
}

function normalizeRate(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") return "0";
  return String(value);
}

function percentageAmount(amount: string, rate: string | number) {
  const basisPoints = percentageToBasisPoints(rate);
  const micros = applyBasisPoints(decimalUsdToMicros(amount), basisPoints);
  return { amount: microsToDecimalUsd(micros) };
}

function multiplyDecimal(amount: string, rate: string | number) {
  const value = Number(amount) * Number(rate);
  return Number.isFinite(value) ? value.toFixed(6).replace(/\.?0+$/, "") : "0";
}

function hashBuffer(content: Buffer) {
  let hash = 0;
  for (const byte of content) hash = (hash * 31 + byte) >>> 0;
  return `h_${hash.toString(16)}`;
}

function addMonths(date: Date, months: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next.toISOString();
}

function moneyString(amount: number, currency: CurrencyCode) {
  return `${normalizeCurrency(currency)} ${Math.max(0, amount).toFixed(2)}`;
}
