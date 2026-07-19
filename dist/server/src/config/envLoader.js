import { existsSync, readFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
const REQUIRED_SERVER_ENV = [
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "DATABASE_URL",
];
const ENV_FILES = [".env", ".env.local", "server/.env"];
let loaded = false;
let result = null;
export function loadRuntimeEnv() {
    if (loaded && result)
        return result;
    const env = getEnv();
    const protectedKeys = new Set(Object.keys(env).filter((key) => hasValue(env[key])));
    const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
    const loadedFiles = [];
    for (const relativePath of ENV_FILES) {
        const absolutePath = resolve(projectRoot, relativePath);
        if (!existsSync(absolutePath))
            continue;
        const parsed = parseDotenv(readFileSync(absolutePath, "utf8"));
        for (const [key, value] of Object.entries(parsed)) {
            if (protectedKeys.has(key))
                continue;
            if (hasValue(value) || !hasValue(env[key]))
                env[key] = value;
        }
        loadedFiles.push(relativePath);
    }
    normalizeDatabaseUrl(env);
    loaded = true;
    result = {
        loaded: loadedFiles,
        missing: REQUIRED_SERVER_ENV.filter((key) => !hasValue(env[key])),
        present: Object.fromEntries(REQUIRED_SERVER_ENV.map((key) => [key, mask(env[key])])),
    };
    return result;
}
export function logAndRequireStartupEnvironment() {
    const required = ["DATABASE_URL", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"];
    const missing = [];
    for (const name of required) {
        const present = hasValue(process.env[name]);
        console.log(`${name}: ${present ? "PRESENT" : "MISSING"}`);
        if (!present)
            missing.push(name);
    }
    if (missing.length > 0) {
        throw new Error(`Startup environment check failed. Missing required variables: ${missing.join(", ")}`);
    }
}
export function logRuntimeEnv(component) {
    const loadedEnv = loadRuntimeEnv();
    const log = getConsole();
    log.info(`[${component}] env loaded`, { files: loadedEnv.loaded });
    if (loadedEnv.missing.length) {
        log.warn(`[${component}] missing env`, { missing: loadedEnv.missing });
    }
    log.info(`[${component}] runtime env validation`, {
        ok: loadedEnv.missing.length === 0,
        values: loadedEnv.present,
    });
}
export function getRequiredServerEnvNames() {
    return [...REQUIRED_SERVER_ENV];
}
function normalizeDatabaseUrl(env) {
    if (!hasValue(env.DATABASE_URL) && hasValue(env.PAYMENT_DATABASE_URL)) {
        env.DATABASE_URL = env.PAYMENT_DATABASE_URL;
    }
    if (!hasValue(env.PAYMENT_DATABASE_URL) && hasValue(env.DATABASE_URL)) {
        env.PAYMENT_DATABASE_URL = env.DATABASE_URL;
    }
}
function parseDotenv(content) {
    const parsed = {};
    for (const rawLine of content.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line || line.startsWith("#"))
            continue;
        const match = line.match(/^([\w.-]+)\s*=\s*(.*)$/);
        if (!match)
            continue;
        const key = match[1];
        let value = match[2] ?? "";
        value = stripInlineComment(value).trim();
        parsed[key] = unquote(value);
    }
    return parsed;
}
function stripInlineComment(value) {
    let quote = null;
    for (let i = 0; i < value.length; i += 1) {
        const char = value[i];
        if ((char === "\"" || char === "'") && value[i - 1] !== "\\") {
            quote = quote === char ? null : quote || char;
        }
        if (char === "#" && !quote && /\s/.test(value[i - 1] || "")) {
            return value.slice(0, i);
        }
    }
    return value;
}
function unquote(value) {
    if ((value.startsWith("\"") && value.endsWith("\"")) ||
        (value.startsWith("'") && value.endsWith("'"))) {
        const quote = value[0];
        const inner = value.slice(1, -1);
        return quote === "\"" ? inner.replace(/\\n/g, "\n").replace(/\\"/g, "\"") : inner;
    }
    return value;
}
function mask(value) {
    if (!hasValue(value))
        return "<missing>";
    if (value.length <= 8)
        return "********";
    return `${value.slice(0, 4)}...${value.slice(-4)}`;
}
function hasValue(value) {
    return typeof value === "string" && value.trim().length > 0;
}
function getEnv() {
    return process.env;
}
function getConsole() {
    return typeof console !== "undefined" ? console : { info: () => undefined, warn: () => undefined };
}
