import { randomInt } from "crypto";

import { loadRuntimeEnv } from "../config/envLoader";
import type { SqlExecutor } from "./services/distributionStore";

export type DistributionIdentifierBundle = {
  upc: string;
  isrcs: string[];
};

export type DistributionIdGenerationOptions = {
  countryCode?: string;
  registrantCode?: string;
};

const UPC_LENGTH = 12;
const ISRC_SEQUENCE_LENGTH = 5;
const DEFAULT_COUNTRY_CODE = "US";
const DEFAULT_REGISTRANT_CODE = "TSY";
const MAX_UPC_ATTEMPTS = 128;

export class DistributionIdGenerator {
  private readonly countryCode: string;
  private readonly registrantCode: string;
  private readonly isrcContexts = new Map<string, IsrcContext>();

  constructor(private readonly db: SqlExecutor, options: DistributionIdGenerationOptions = {}) {
    loadRuntimeEnv();
    this.countryCode = normalizeCountryCode(options.countryCode ?? readEnv("ISRC_COUNTRY_CODE") ?? DEFAULT_COUNTRY_CODE);
    this.registrantCode = normalizeRegistrantCode(options.registrantCode ?? readEnv("ISRC_REGISTRANT_CODE") ?? DEFAULT_REGISTRANT_CODE);
  }

  async generateUPC(): Promise<string> {
    for (let attempt = 0; attempt < MAX_UPC_ATTEMPTS; attempt += 1) {
      const candidate = randomInt(0, 10 ** UPC_LENGTH).toString().padStart(UPC_LENGTH, "0");
      if (!(await this.upcExists(candidate))) return candidate;
    }

    throw new Error("Unable to generate a unique UPC after repeated retries.");
  }

  async generateISRC(): Promise<string> {
    const context = await this.getIsrcContext();
    while (context.nextSequence <= 99999) {
      const candidate = this.formatISRC(context, context.nextSequence);
      context.nextSequence += 1;
      if (context.used.has(candidate)) continue;
      if (await this.isrcExists(candidate)) {
        context.used.add(candidate);
        continue;
      }
      context.used.add(candidate);
      return candidate;
    }

    throw new Error(`Unable to generate a unique ISRC for ${context.prefix}.`);
  }

  async generateBundle(trackCount: number): Promise<DistributionIdentifierBundle> {
    const upc = await this.generateUPC();
    const isrcs: string[] = [];
    for (let index = 0; index < Math.max(0, trackCount); index += 1) {
      isrcs.push(await this.generateISRC());
    }
    return { upc, isrcs };
  }

  private async getIsrcContext(): Promise<IsrcContext> {
    const year = new Date().getUTCFullYear().toString().slice(-2);
    const prefix = `${this.countryCode}${this.registrantCode}${year}`;
    const cached = this.isrcContexts.get(prefix);
    if (cached) return cached;

    const existing = await this.db.query<{ isrc: string }>(
      `SELECT isrc
       FROM tracks
       WHERE isrc LIKE :prefix
       UNION ALL
       SELECT isrc
       FROM songs
       WHERE isrc LIKE :prefix`,
      { prefix: `${prefix}%` },
    );

    const used = new Set<string>();
    let maxSequence = 0;
    for (const row of existing) {
      const value = normalizeIsrc(row.isrc);
      if (!value.startsWith(prefix) || value.length !== prefix.length + ISRC_SEQUENCE_LENGTH) continue;
      const sequence = Number(value.slice(prefix.length));
      if (!Number.isInteger(sequence) || sequence <= 0) continue;
      used.add(value);
      if (sequence > maxSequence) maxSequence = sequence;
    }

    const context: IsrcContext = {
      prefix,
      nextSequence: maxSequence + 1,
      used,
    };
    this.isrcContexts.set(prefix, context);
    return context;
  }

  private async upcExists(candidate: string): Promise<boolean> {
    const rows = await this.db.query<{ id: string }>(
      `SELECT id
       FROM releases
       WHERE upc = :candidate
       LIMIT 1`,
      { candidate },
    );
    return rows.length > 0;
  }

  private async isrcExists(candidate: string): Promise<boolean> {
    const rows = await this.db.query<{ id: string }>(
      `SELECT id
       FROM tracks
       WHERE isrc = :candidate
       UNION ALL
       SELECT id
       FROM songs
       WHERE isrc = :candidate
       LIMIT 1`,
      { candidate },
    );
    return rows.length > 0;
  }

  private formatISRC(context: IsrcContext, sequence: number): string {
    return `${context.prefix}${sequence.toString().padStart(ISRC_SEQUENCE_LENGTH, "0")}`;
  }
}

export async function generateUPC(db: SqlExecutor, options: DistributionIdGenerationOptions = {}): Promise<string> {
  return new DistributionIdGenerator(db, options).generateUPC();
}

export async function generateISRC(db: SqlExecutor, options: DistributionIdGenerationOptions = {}): Promise<string> {
  return new DistributionIdGenerator(db, options).generateISRC();
}

export async function generateDistributionIdentifiers(db: SqlExecutor, trackCount: number, options: DistributionIdGenerationOptions = {}): Promise<DistributionIdentifierBundle> {
  return new DistributionIdGenerator(db, options).generateBundle(trackCount);
}

type IsrcContext = {
  prefix: string;
  nextSequence: number;
  used: Set<string>;
};

function normalizeCountryCode(value: string): string {
  const normalized = value.trim().toUpperCase().replace(/[^A-Z]/g, "");
  return normalized.slice(0, 2).padEnd(2, "X");
}

function normalizeRegistrantCode(value: string): string {
  const normalized = value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  return normalized.slice(0, 3).padEnd(3, "X");
}

function normalizeIsrc(value: string): string {
  return value.trim().replace(/[-\s]/g, "").toUpperCase();
}

function readEnv(key: string): string | undefined {
  return process.env[key];
}
