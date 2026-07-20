import sequelize from "sequelize";
const { QueryTypes } = sequelize;
export async function getPayoutStatus(deps, input) {
    const rows = await deps.sequelize.query(`SELECT * FROM payout_requests WHERE id = :id LIMIT 1`, { replacements: { id: input.payout_id }, type: QueryTypes.SELECT });
    const row = rows[0];
    return row ?? null;
}
