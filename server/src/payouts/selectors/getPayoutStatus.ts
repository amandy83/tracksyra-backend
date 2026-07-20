import type { Sequelize } from "sequelize";
import sequelize from "sequelize";

const { QueryTypes } = sequelize;
import type { PayoutId, PayoutState, PayoutRecord } from "../models/payoutTypes";

export type GetPayoutStatusInput = {
  payout_id: PayoutId;
};

export async function getPayoutStatus(deps: { sequelize: Sequelize }, input: GetPayoutStatusInput): Promise<PayoutRecord | null> {
  const rows = await deps.sequelize.query<PayoutRecord>(
    `SELECT * FROM payout_requests WHERE id = :id LIMIT 1`,
    { replacements: { id: input.payout_id }, type: QueryTypes.SELECT },
  );

  const row = rows[0];
  return row ?? null;
}

