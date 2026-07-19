import { randomInt } from "crypto";
import { loadRuntimeEnv } from "../config/envLoader.js";
const UPC_LENGTH = 12;
const ISRC_SEQUENCE_LENGTH = 5;
const DEFAULT_COUNTRY_CODE = "US";
const DEFAULT_REGISTRANT_CODE = "TSY";
const MAX_UPC_ATTEMPTS = 128;
export class DistributionIdGenerator {
    db;
    countryCode;
    registrantCode;
    isrcContexts = new Map();
    constructor(db, options = {}) {
        this.db = db;
        loadRuntimeEnv();
        this.countryCode = normalizeCountryCode(options.countryCode ?? readEnv("ISRC_COUNTRY_CODE") ?? DEFAULT_COUNTRY_CODE);
        this.registrantCode = normalizeRegistrantCode(options.registrantCode ?? readEnv("ISRC_REGISTRANT_CODE") ?? DEFAULT_REGISTRANT_CODE);
    }
    async generateUPC() {
        for (let attempt = 0; attempt < MAX_UPC_ATTEMPTS; attempt += 1) {
            const candidate = randomInt(0, 10 ** UPC_LENGTH).toString().padStart(UPC_LENGTH, "0");
            if (!(await this.upcExists(candidate)))
                return candidate;
        }
        throw new Error("Unable to generate a unique UPC after repeated retries.");
    }
    async generateISRC() {
        const context = await this.getIsrcContext();
        while (context.nextSequence <= 99999) {
            const candidate = this.formatISRC(context, context.nextSequence);
            context.nextSequence += 1;
            if (context.used.has(candidate))
                continue;
            if (await this.isrcExists(candidate)) {
                context.used.add(candidate);
                continue;
            }
            context.used.add(candidate);
            return candidate;
        }
        throw new Error(`Unable to generate a unique ISRC for ${context.prefix}.`);
    }
    async generateBundle(trackCount) {
        const upc = await this.generateUPC();
        const isrcs = [];
        for (let index = 0; index < Math.max(0, trackCount); index += 1) {
            isrcs.push(await this.generateISRC());
        }
        return { upc, isrcs };
    }
    async getIsrcContext() {
        const year = new Date().getUTCFullYear().toString().slice(-2);
        const prefix = `${this.countryCode}${this.registrantCode}${year}`;
        const cached = this.isrcContexts.get(prefix);
        if (cached)
            return cached;
        const existing = await this.db.query(`SELECT isrc
       FROM tracks
       WHERE isrc LIKE :prefix
       UNION ALL
       SELECT isrc
       FROM songs
       WHERE isrc LIKE :prefix`, { prefix: `${prefix}%` });
        const used = new Set();
        let maxSequence = 0;
        for (const row of existing) {
            const value = normalizeIsrc(row.isrc);
            if (!value.startsWith(prefix) || value.length !== prefix.length + ISRC_SEQUENCE_LENGTH)
                continue;
            const sequence = Number(value.slice(prefix.length));
            if (!Number.isInteger(sequence) || sequence <= 0)
                continue;
            used.add(value);
            if (sequence > maxSequence)
                maxSequence = sequence;
        }
        const context = {
            prefix,
            nextSequence: maxSequence + 1,
            used,
        };
        this.isrcContexts.set(prefix, context);
        return context;
    }
    async upcExists(candidate) {
        const rows = await this.db.query(`SELECT id
       FROM releases
       WHERE upc = :candidate
       LIMIT 1`, { candidate });
        return rows.length > 0;
    }
    async isrcExists(candidate) {
        const rows = await this.db.query(`SELECT id
       FROM tracks
       WHERE isrc = :candidate
       UNION ALL
       SELECT id
       FROM songs
       WHERE isrc = :candidate
       LIMIT 1`, { candidate });
        return rows.length > 0;
    }
    formatISRC(context, sequence) {
        return `${context.prefix}${sequence.toString().padStart(ISRC_SEQUENCE_LENGTH, "0")}`;
    }
}
export async function generateUPC(db, options = {}) {
    return new DistributionIdGenerator(db, options).generateUPC();
}
export async function generateISRC(db, options = {}) {
    return new DistributionIdGenerator(db, options).generateISRC();
}
export async function generateDistributionIdentifiers(db, trackCount, options = {}) {
    return new DistributionIdGenerator(db, options).generateBundle(trackCount);
}
function normalizeCountryCode(value) {
    const normalized = value.trim().toUpperCase().replace(/[^A-Z]/g, "");
    return normalized.slice(0, 2).padEnd(2, "X");
}
function normalizeRegistrantCode(value) {
    const normalized = value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    return normalized.slice(0, 3).padEnd(3, "X");
}
function normalizeIsrc(value) {
    return value.trim().replace(/[-\s]/g, "").toUpperCase();
}
function readEnv(key) {
    return process.env[key];
}
