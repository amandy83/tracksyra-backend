export class FraudReviewQueue {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    async enqueueSuspiciousEvent(fraudEventId) {
        await this.deps.store.createReview(fraudEventId);
    }
    async decideReview(input) {
        const reviewEvent = await this.deps.store.getFraudEventByReview(input.reviewId);
        if (!reviewEvent)
            throw new Error(`Fraud review not found: ${input.reviewId}`);
        await this.deps.store.appendReviewDecision({
            fraudEventId: reviewEvent.fraud_event_id,
            decision: input.decision,
            reviewerId: input.reviewerId,
            notes: input.notes ?? null,
        });
        if (input.decision === "APPROVE") {
            if (!this.deps.processingEngine)
                throw new Error("Processing engine required to approve and reprocess stream");
            await this.deps.processingEngine.processEvents({
                batchId: `fraud-review-approved:${input.reviewId}`,
                provider: reviewEvent.raw_event.provider,
                events: [reviewEvent.raw_event],
            });
        }
        if (input.decision === "ESCALATE") {
            if (reviewEvent.user_id) {
                await this.deps.store.upsertUserRiskScore({
                    userId: reviewEvent.user_id,
                    scoreDelta: 20,
                    reason: `Manual escalation for fraud review ${input.reviewId}`,
                });
            }
        }
    }
}
