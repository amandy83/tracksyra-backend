import { QueryTypes, Sequelize } from "sequelize";
import type { SqlExecutor } from "./distributionStore";

export class SequelizeSqlExecutor implements SqlExecutor {
  constructor(private sequelize: Sequelize) {}

  async query<T extends object = Record<string, unknown>>(sql: string, params: Record<string, unknown> = {}): Promise<T[]> {
    return this.sequelize.query<T>(sql, {
      replacements: params,
      type: QueryTypes.SELECT,
    }) as Promise<T[]>;
  }
}

export function createSequelize(databaseUrl: string): Sequelize {
  if (!databaseUrl) throw new Error("DATABASE_URL is required for SQL-backed distribution infrastructure.");
  return new Sequelize(databaseUrl, {
    logging: false,
    dialectOptions: {
      ssl: databaseUrl.includes("sslmode=require") ? { require: true, rejectUnauthorized: false } : undefined,
    },
  });
}
