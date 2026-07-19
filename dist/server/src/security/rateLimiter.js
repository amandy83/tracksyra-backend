import { logger } from "../observability/logger.js";
export const rateLimitRules = {
    api: { name: "api", windowMs: 60_000, max: 600 },
    upload: { name: "upload", windowMs: 60_000, max: 30 },
    webhook: { name: "webhook", windowMs: 60_000, max: 300 },
    payout: { name: "payout", windowMs: 60_000, max: 20 },
};
const buckets = new Map();
export function checkRateLimit(rule, identity) {
    const key = `${rule.name}:${identity}`;
    const now = Date.now();
    const bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
        buckets.set(key, { count: 1, resetAt: now + rule.windowMs });
        return { allowed: true, remaining: rule.max - 1, resetAt: now + rule.windowMs };
    }
    bucket.count += 1;
    const allowed = bucket.count <= rule.max;
    if (!allowed) {
        logger.warn("rate limit exceeded", { rule: rule.name, identity, count: bucket.count, max: rule.max });
    }
    return { allowed, remaining: Math.max(rule.max - bucket.count, 0), resetAt: bucket.resetAt };
}
export function suspiciousActivityLog(input) {
    logger.warn("suspicious activity", input);
}
export function getClientIp(headers, socketAddress) {
    const forwarded = value(headers["x-forwarded-for"]);
    if (forwarded)
        return forwarded.split(",")[0].trim();
    return value(headers["x-real-ip"]) || socketAddress || "unknown";
}
function value(input) {
    return Array.isArray(input) ? input[0] : input;
}
