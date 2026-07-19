import { createWorker } from "../../queue/queueFactory.js";
import { queueNames } from "../../queue/queueNames.js";
export function registerRoyaltyWorker(engine, options = {}) {
    return createWorker(queueNames.royalty, async (job) => {
        const data = job.data;
        if (data.type !== "TRACK_REVENUE_RECALCULATION")
            return;
        await engine.calculateTrackRevenue(data.input);
    }, { concurrency: options.concurrency });
}
