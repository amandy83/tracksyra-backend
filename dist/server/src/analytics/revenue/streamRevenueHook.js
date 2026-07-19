export class StreamRevenueHook {
    royaltyEngine;
    constructor(royaltyEngine) {
        this.royaltyEngine = royaltyEngine;
    }
    async handleStreamUpdate(event) {
        return this.royaltyEngine.calculateTrackRevenue({
            trackId: event.trackId,
            eventId: event.eventId,
            periodStart: event.periodStart ?? null,
            periodEnd: event.periodEnd ?? null,
        });
    }
}
