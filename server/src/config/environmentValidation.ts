import { getRequiredServerEnvNames, loadRuntimeEnv } from "./envLoader";

export type EnvironmentValidationResult = {
  ok: boolean;
  errors: string[];
  warnings: string[];
};

export function validateProductionEnvironment(): EnvironmentValidationResult {
  loadRuntimeEnv();
  const env = getEnv();
  const production = env.NODE_ENV === "production";
  const tooLostWebhooksEnabled = isEnabled(env.TOO_LOST_WEBHOOKS_ENABLED);
  const errors: string[] = [];
  const warnings: string[] = [];

  if (production && !hasRedisConnectionConfig(env)) {
    errors.push("Redis configuration is required in production. Set REDIS_URL or REDIS_HOST/REDIS_PORT.");
  }
  requireWhen(production, "PAYMENT_DATABASE_URL", errors);
  for (const name of getRequiredServerEnvNames()) requireAlways(name, errors);

  const hasResend = Boolean(env.RESEND_API_KEY);
  const hasSmtp = Boolean(env.SMTP_HOST && (env.SMTP_USERNAME || env.SMTP_USER) && (env.SMTP_PASSWORD || env.SMTP_PASS));
  if (production && !hasResend && !hasSmtp) errors.push("RESEND_API_KEY or SMTP_* configuration is required in production.");
  if (!production && !hasResend && !hasSmtp) warnings.push("Email provider is not configured; local fallback may be used.");
  if (production && hasResend && !env.RESEND_WEBHOOK_SECRET) {
    errors.push("RESEND_WEBHOOK_SECRET is required in production when RESEND_API_KEY is configured.");
  }

  if (production && tooLostWebhooksEnabled && !env.TOO_LOST_WEBHOOK_SECRET) {
    errors.push("TOO_LOST_WEBHOOK_SECRET is required when TOO_LOST_WEBHOOKS_ENABLED is true.");
  }
  if (!env.TOO_LOST_CLIENT_ID) warnings.push("TOO_LOST_CLIENT_ID is empty pending Too Lost app approval.");
  if (!env.TOO_LOST_CLIENT_SECRET) warnings.push("TOO_LOST_CLIENT_SECRET is empty pending Too Lost app approval.");
  if (tooLostWebhooksEnabled && !env.TOO_LOST_WEBHOOK_SECRET) warnings.push("TOO_LOST_WEBHOOK_SECRET is empty pending Too Lost webhook approval.");
  if (!env.TOO_LOST_TOKEN_ENCRYPTION_KEY) warnings.push("TOO_LOST_TOKEN_ENCRYPTION_KEY is empty; token storage cannot be encrypted.");
  if (env.TOO_LOST_INTEGRATION_APPROVED === "true" && (!env.TOO_LOST_CLIENT_ID || !env.TOO_LOST_CLIENT_SECRET || !env.TOO_LOST_TOKEN_ENCRYPTION_KEY || (tooLostWebhooksEnabled && !env.TOO_LOST_WEBHOOK_SECRET))) {
    errors.push("Too Lost live approval is enabled but OAuth/encryption credentials are incomplete or webhook configuration is missing.");
  }

  return { ok: errors.length === 0, errors, warnings };
}

export function assertProductionEnvironment() {
  const result = validateProductionEnvironment();
  if (!result.ok) throw new Error(`Environment validation failed: ${result.errors.join("; ")}`);
  return result;
}

function requireWhen(condition: boolean, name: string, errors: string[]) {
  if (condition && !getEnv()[name]) errors.push(`${name} is required in production.`);
}

function requireAlways(name: string, errors: string[]) {
  if (!getEnv()[name]) errors.push(`${name} is required.`);
}

function getEnv(): Record<string, string | undefined> {
  return process.env;
}

function isEnabled(value: string | undefined): boolean {
  return ["1", "true", "yes", "on"].includes(String(value ?? "").toLowerCase());
}

function hasRedisConnectionConfig(env: Record<string, string | undefined>): boolean {
  if (env.REDIS_URL) return true;
  return Boolean(env.REDIS_HOST && env.REDIS_PORT);
}
