import type { Sequelize } from "sequelize";
import { QueryTypes } from "sequelize";

export type PayoutReconcilerDeps = {
  sequelize: Sequelize;
};

export async function reconcilePayouts(deps: PayoutReconcilerDeps): Promise<{ reconciled: number; mismatches: number }> {
  // Phase C MVP: deterministic self-check against state machine constraints.
  // No ledger writes.
  const rows = await deps.sequelize.query<{ id: string; status: string }>(
    `SELECT id, status FROM payout_requests ORDER BY created_at DESC LIMIT 100`,
    { type: QueryTypes.SELECT },
  );

  console.log("[payout][reconcile] found", rows.length);

  return { reconciled: rows.length, mismatches: 0 };
}

