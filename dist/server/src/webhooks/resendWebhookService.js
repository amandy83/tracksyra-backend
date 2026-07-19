import { createHmac, timingSafeEqual } from "crypto";
import { loadRuntimeEnv } from "../config/envLoader.js";
const trackedEvents = new Set([
    "email.delivered",
    "email.opened",
    "email.clicked",
    "email.bounced",
    "email.complained",
]);
const statusByEvent = {
    delivered: "DELIVERED",
    opened: "OPENED",
    clicked: "CLICKED",
    bounced: "BOUNCED",
    complained: "COMPLAINED",
};
export class ResendWebhookService {
    supabase;
    constructor(supabase) {
        this.supabase = supabase;
    }
    async handle(rawBody, headers) {
        verifyResendSignature(rawBody, headers);
        const payload = JSON.parse(rawBody);
        if (!trackedEvents.has(payload.type))
            return { ok: true, tracked: false };
        const eventType = payload.type.replace(/^email\./, "");
        const messageId = payload.data?.email_id || payload.data?.message_id;
        const recipients = recipientsFromPayload(payload);
        const eventPayload = payload.data?.[eventType];
        const eventTimestamp = timestampValue(eventPayload && typeof eventPayload === "object" ? eventPayload.timestamp : null)
            ?? timestampValue(payload.created_at)
            ?? new Date().toISOString();
        for (const recipient of recipients) {
            const { error } = await this.supabase.from("email_events").insert({
                message_id: messageId,
                recipient,
                event_type: eventType,
                event_timestamp: eventTimestamp,
                raw_payload: payload,
            });
            if (error)
                throw new Error(`Failed to write email event: ${error.message}`);
            if (messageId) {
                await this.supabase
                    .from("email_delivery_logs")
                    .update({ status: statusByEvent[eventType] || eventType.toUpperCase() })
                    .eq("message_id", messageId)
                    .eq("to_email", recipient);
            }
        }
        return { ok: true, tracked: true, eventType, messageId, recipients: recipients.length };
    }
}
function verifyResendSignature(rawBody, headers) {
    const secret = readEnv("RESEND_WEBHOOK_SECRET");
    if (!secret && readEnv("NODE_ENV") !== "production")
        return;
    if (!secret)
        throw httpError(401, "MISSING_RESEND_WEBHOOK_SECRET");
    const id = headerValue(headers, "svix-id");
    const timestamp = headerValue(headers, "svix-timestamp");
    const signature = headerValue(headers, "svix-signature");
    if (!id || !timestamp || !signature)
        throw httpError(401, "INVALID_RESEND_WEBHOOK_SIGNATURE");
    const ageSeconds = Math.abs(Date.now() / 1000 - Number(timestamp));
    if (!Number.isFinite(ageSeconds) || ageSeconds > 300)
        throw httpError(401, "STALE_RESEND_WEBHOOK_SIGNATURE");
    const key = secret.startsWith("whsec_")
        ? Buffer.from(secret.slice("whsec_".length), "base64")
        : Buffer.from(secret, "utf8");
    const expected = createHmac("sha256", key).update(`${id}.${timestamp}.${rawBody}`).digest();
    const valid = signature.split(" ").some((candidate) => {
        const encoded = candidate.includes(",") ? candidate.split(",")[1] : candidate;
        const actual = Buffer.from(encoded, "base64");
        return actual.length === expected.length && timingSafeEqual(actual, expected);
    });
    if (!valid)
        throw httpError(401, "INVALID_RESEND_WEBHOOK_SIGNATURE");
}
function recipientsFromPayload(payload) {
    const recipients = payload.data?.to || [];
    return recipients.map((value) => String(value).trim().toLowerCase()).filter(Boolean);
}
function timestampValue(value) {
    return typeof value === "string" && !Number.isNaN(Date.parse(value)) ? value : null;
}
function headerValue(headers, key) {
    const value = headers[key] || headers[key.toLowerCase()];
    return Array.isArray(value) ? value[0] : value;
}
function readEnv(name) {
    loadRuntimeEnv();
    return process.env[name];
}
function httpError(status, code) {
    const error = new Error(code);
    error.status = status;
    error.code = code;
    return error;
}
