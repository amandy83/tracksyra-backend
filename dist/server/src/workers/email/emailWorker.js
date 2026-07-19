import { createWorker } from "../../queue/queueFactory.js";
import { queueNames } from "../../queue/queueNames.js";
import { dispatchPendingEmailQueue, getSupabaseClient } from "../../notifications/emailQueue.js";
import { sendQueuedEmail, setEmailDeliveryLogger } from "../../notifications/emailService.js";
import { captureException } from "../../observability/errorTracker.js";
import { incrementMetric, recordJobLatency, recordRetry, setMetric } from "../../queue/metrics.js";
const RETRY_DELAYS_MS = [1000, 5000, 15000];
export function registerEmailWorker(options = {}) {
    setEmailDeliveryLogger(writeEmailDeliveryLog);
    const worker = createWorker(queueNames.email, processEmailJob, { concurrency: options.concurrency });
    const stopDispatcher = startEmailQueueDispatcher(options.dispatchIntervalMs ?? 5000);
    return { worker, stopDispatcher };
}
export async function processEmailJob(job) {
    const row = await markProcessing(job.data.emailQueueId);
    if (!row)
        return { skipped: true };
    const createdAt = Date.parse(row.created_at);
    if (Number.isFinite(createdAt)) {
        const latencyMs = Math.max(Date.now() - createdAt, 0);
        recordJobLatency(queueNames.email, latencyMs);
        setMetric("tracksyra_email_processing_latency_ms", { queue: queueNames.email }, latencyMs);
    }
    try {
        await sendQueuedEmail({
            to: job.data.to,
            subject: job.data.subject,
            html: job.data.html,
            text: job.data.text || undefined,
            metadata: {
                emailQueueId: job.data.emailQueueId,
                templateType: job.data.templateType,
                payload: job.data.payload || {},
            },
        });
        await markSent(job.data.emailQueueId);
        incrementMetric("tracksyra_email_delivery_total", { status: "sent" });
        return { sent: true, traceId: job.data.traceId, correlationId: job.data.correlationId };
    }
    catch (error) {
        const state = await markFailedOrRetrying(row, error);
        incrementMetric("tracksyra_email_delivery_failures_total", { state });
        if (state === "RETRYING")
            recordRetry(queueNames.email);
        await captureException({
            error,
            context: {
                component: "email-worker",
                emailQueueId: job.data.emailQueueId,
                traceId: job.data.traceId,
                correlationId: job.data.correlationId,
                actorUserId: job.data.actorUserId,
            },
            tags: { worker: "email", state },
        });
        if (state === "FAILED")
            throw error;
        return { retrying: true, traceId: job.data.traceId, correlationId: job.data.correlationId };
    }
}
function startEmailQueueDispatcher(intervalMs) {
    let stopped = false;
    let timer = null;
    const tick = async () => {
        if (stopped)
            return;
        try {
            await dispatchPendingEmailQueue();
        }
        catch (error) {
            console.warn("[email-worker] email_queue dispatch failed", error);
        }
        finally {
            if (!stopped)
                timer = setTimeout(tick, intervalMs);
        }
    };
    timer = setTimeout(tick, 0);
    return async () => {
        stopped = true;
        if (timer)
            clearTimeout(timer);
    };
}
async function markProcessing(id) {
    const { data, error } = await getSupabaseClient()
        .from("email_queue")
        .update({ status: "PROCESSING", updated_at: new Date().toISOString() })
        .eq("id", id)
        .in("status", ["PENDING", "RETRYING", "PROCESSING"])
        .select("*")
        .maybeSingle();
    if (error)
        throw new Error(`Failed to mark email PROCESSING: ${error.message}`);
    return data;
}
async function markSent(id) {
    const { error } = await getSupabaseClient()
        .from("email_queue")
        .update({ status: "SENT", last_error: null, updated_at: new Date().toISOString() })
        .eq("id", id);
    if (error)
        throw new Error(`Failed to mark email SENT: ${error.message}`);
}
async function markFailedOrRetrying(job, error) {
    const retryCount = (job.retry_count || 0) + 1;
    const message = error instanceof Error ? error.message : String(error);
    const status = retryCount > job.max_retries ? "FAILED" : "RETRYING";
    const scheduledAt = status === "RETRYING"
        ? new Date(Date.now() + retryDelayMs(retryCount)).toISOString()
        : job.scheduled_at;
    const { error: updateError } = await getSupabaseClient()
        .from("email_queue")
        .update({
        status,
        retry_count: retryCount,
        last_error: message,
        scheduled_at: scheduledAt,
        updated_at: new Date().toISOString(),
    })
        .eq("id", job.id);
    if (updateError)
        throw new Error(`Failed to update email retry state: ${updateError.message}`);
    incrementMetric("tracksyra_email_retry_total", { state: status });
    return status;
}
function retryDelayMs(retryCount) {
    return RETRY_DELAYS_MS[Math.min(Math.max(retryCount - 1, 0), RETRY_DELAYS_MS.length - 1)];
}
const writeEmailDeliveryLog = async (entry) => {
    const { error } = await getSupabaseClient().from("email_delivery_logs").insert({
        to_email: entry.to_email,
        subject: entry.subject,
        status: entry.status,
        provider_response: entry.provider_response || {},
        message_id: entry.message_id || null,
        smtp_response: entry.smtp_response || null,
        error_message: entry.error_message || null,
    });
    if (error)
        throw new Error(`Failed to write email delivery log: ${error.message}`);
};
