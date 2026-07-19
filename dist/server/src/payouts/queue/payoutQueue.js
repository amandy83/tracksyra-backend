import { enqueueWithDefaults } from "../../queue/queueFactory.js";
import { createJobTrace } from "../../queue/jobTypes.js";
import { queueNames } from "../../queue/queueNames.js";
import { checkRateLimit, rateLimitRules, suspiciousActivityLog } from "../../security/rateLimiter.js";
export async function enqueuePayoutJob(input) {
    const abuse = checkRateLimit(rateLimitRules.payout, input.actor || input.payout_id);
    if (!abuse.allowed) {
        suspiciousActivityLog({
            category: "payout",
            ip: "worker",
            actorUserId: input.actor ?? null,
            reason: "payout queue abuse limit",
            metadata: { payout_id: input.payout_id },
        });
        throw new Error("Payout abuse limit exceeded");
    }
    const trace = createJobTrace({
        idempotencyKey: `payout:${input.payout_id}:${input.correlation_id}`,
        traceId: input.correlation_id,
        correlationId: input.correlation_id,
        actorUserId: input.actor ?? null,
        sourceSystem: "api",
    });
    const job = { ...trace, ...input };
    return enqueueWithDefaults(queueNames.payout, "payout.process", job);
}
