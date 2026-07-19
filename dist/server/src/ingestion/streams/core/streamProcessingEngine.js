export class StreamProcessingEngine {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    async processEvents(input) {
        const result = {
            received: input.events.length,
            inserted: 0,
            duplicates: 0,
            processed_event_ids: [],
            royalty_recalculation_keys: [],
        };
        try {
            const insertedEvents = [];
            for (const event of input.events) {
                const inserted = await this.deps.store.insertEvent(event);
                if (!inserted) {
                    result.duplicates += 1;
                    continue;
                }
                await this.deps.store.applyEventToStats(event);
                insertedEvents.push(event);
                result.inserted += 1;
                result.processed_event_ids.push(event.event_id);
            }
            const recalculationInputs = this.buildRecalculationInputs(input.batchId, insertedEvents);
            for (const recalculation of recalculationInputs) {
                await this.deps.royaltyEngine.calculateTrackRevenue({
                    trackId: recalculation.trackId,
                    eventId: recalculation.key,
                    periodStart: recalculation.periodStart,
                    periodEnd: recalculation.periodEnd,
                });
                result.royalty_recalculation_keys.push(recalculation.key);
                await this.deps.emitRevenueUpdate?.({
                    batch_id: input.batchId,
                    track_id: recalculation.trackId,
                    recalculation_key: recalculation.key,
                });
            }
            await this.deps.analyticsService?.persistSnapshot();
            await this.deps.streamAnalyticsService?.persistSnapshot();
            await this.deps.store.appendProcessingLog({
                batchId: input.batchId,
                provider: input.provider,
                status: "PROCESSED",
                result,
            });
            return result;
        }
        catch (error) {
            await this.deps.store.appendProcessingLog({
                batchId: input.batchId,
                provider: input.provider,
                status: "FAILED",
                result,
                error: error instanceof Error ? error.message : String(error),
            });
            throw error;
        }
    }
    buildRecalculationInputs(batchId, events) {
        const keys = new Map();
        for (const event of events) {
            const day = event.timestamp.slice(0, 10);
            const mapKey = `${event.track_id}:${day}`;
            keys.set(mapKey, {
                trackId: event.track_id,
                periodStart: day,
                periodEnd: day,
                key: `stream-recalc:${batchId}:${event.track_id}:${day}`,
            });
        }
        return [...keys.values()];
    }
}
