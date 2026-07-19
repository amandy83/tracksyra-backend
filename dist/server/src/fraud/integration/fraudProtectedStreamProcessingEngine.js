export class FraudProtectedStreamProcessingEngine {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    async processEvents(input) {
        const cleanEvents = [];
        const fraudEventIds = [];
        let suspicious = 0;
        let blocked = 0;
        for (const event of input.events) {
            const score = await this.deps.fraudDetectionEngine.analyzeStreamEvent(event);
            fraudEventIds.push(score.fraud_event_id);
            if (score.decision === "CLEAN") {
                cleanEvents.push(event);
            }
            else if (score.decision === "SUSPICIOUS") {
                suspicious += 1;
                await this.deps.reviewQueue?.enqueueSuspiciousEvent(score.fraud_event_id);
            }
            else {
                blocked += 1;
            }
        }
        const processed = cleanEvents.length
            ? await this.deps.cleanProcessingEngine.processEvents({
                ...input,
                events: cleanEvents,
            })
            : {
                received: 0,
                inserted: 0,
                duplicates: 0,
                processed_event_ids: [],
                royalty_recalculation_keys: [],
            };
        await this.deps.fraudAnalyticsService?.persistSnapshot();
        return {
            ...processed,
            received: input.events.length,
            clean: cleanEvents.length,
            suspicious,
            blocked,
            fraud_event_ids: fraudEventIds,
        };
    }
}
