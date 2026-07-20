import sequelize from "sequelize";
const { QueryTypes } = sequelize;
/**
 * Phase C MVP: history is approximated as current record snapshot.
 * (Audit log / event table can be added in later phases.)
 */
export async function getPayoutHistory(deps, input) {
    const limit = input.limit ?? 10;
    const rows = await deps.sequelize.query(`SELECT * FROM payout_requests WHERE id = :id LIMIT :limit`, { replacements: { id: input.payout_id, limit }, type: QueryTypes.SELECT });
    return rows;
}
