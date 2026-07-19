import { inspectDeadLetterQueue, retryQueueJob } from "../queue/queueFactory.js";
import { enqueueEmailJob } from "../notifications/emailQueue.js";
import { logger } from "../observability/logger.js";
export class AdminRecoveryService {
    supabase;
    constructor(supabase) {
        this.supabase = supabase;
    }
    async replayFailedEmail(emailQueueId) {
        const { data, error } = await this.supabase
            .from("email_queue")
            .update({ status: "PENDING", last_error: null, scheduled_at: new Date().toISOString(), updated_at: new Date().toISOString() })
            .eq("id", emailQueueId)
            .select("*")
            .single();
        if (error)
            throw new Error(`Failed to replay email: ${error.message}`);
        await enqueueEmailJob(data);
        logger.info("admin replayed failed email", { component: "admin-recovery", emailQueueId });
        return data;
    }
    async replayDistributionJob(jobId) {
        await retryQueueJob("distributionQueue", jobId);
        logger.info("admin retried distribution job", { component: "admin-recovery", jobId });
    }
    async replayPayoutJob(jobId) {
        await retryQueueJob("payoutQueue", jobId);
        logger.info("admin retried payout job", { component: "admin-recovery", jobId });
    }
    async replayWebhookFailure(eventId) {
        const { error } = await this.supabase
            .from("distribution_webhook_events")
            .update({ processed_at: null, error_message: null })
            .eq("id", eventId);
        if (error)
            throw new Error(`Failed to replay webhook event: ${error.message}`);
        logger.info("admin replayed webhook failure", { component: "admin-recovery", eventId });
    }
    async inspectDeadLetters(queueName, start = 0, end = 50) {
        return inspectDeadLetterQueue(queueName, start, end);
    }
}
