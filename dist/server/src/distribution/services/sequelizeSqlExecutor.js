import sequelize from "sequelize";
const { QueryTypes, Sequelize } = sequelize;
export class SequelizeSqlExecutor {
    sequelize;
    constructor(sequelize) {
        this.sequelize = sequelize;
    }
    async query(sql, params = {}) {
        return this.sequelize.query(sql, {
            replacements: params,
            type: QueryTypes.SELECT,
        });
    }
}
export function createSequelize(databaseUrl) {
    if (!databaseUrl)
        throw new Error("DATABASE_URL is required for SQL-backed distribution infrastructure.");
    return new Sequelize(databaseUrl, {
        logging: false,
        dialectOptions: {
            ssl: databaseUrl.includes("sslmode=require") ? { require: true, rejectUnauthorized: false } : undefined,
        },
    });
}
