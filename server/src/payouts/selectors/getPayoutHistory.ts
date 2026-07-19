import type { Sequelize } from "sequelize";
import { QueryTypes } from "sequelize";
import type { PayoutId, PayoutRecord } from "../models/payoutTypes";

export type GetPayoutHistoryInput = {
  payout_id: PayoutId;
  limit?: number;
};

/**
 * Phase C MVP: history is approximated as current record snapshot.
 * (Audit log / event table can be added in later phases.)
 */
export async function getPayoutHistory(deps: { sequelize: Sequelize }, input: GetPayoutHistoryInput): Promise<PayoutRecord[]> {
  const limit = input.limit ?? 10;
  const rows = await deps.sequelize.query<PayoutRecord>(
    `SELECT * FROM payout_requests WHERE id = :id LIMIT :limit`,
    { replacements: { id: input.payout_id, limit }, type: QueryTypes.SELECT },
  );
  return rows;
}

