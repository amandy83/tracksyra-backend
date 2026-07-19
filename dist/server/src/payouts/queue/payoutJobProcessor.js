import { createWorker } from "../../queue/queueFactory.js";
import { queueNames } from "../../queue/queueNames.js";
// Worker is instantiated in server entrypoints.
// This file provides wiring only to keep queue deterministic.
export function registerPayoutJobProcessor(engine) {
    return createWorker(queueNames.payout, async (job) => {
        const data = job.data;
        await engine.simulateProcessing(data.payout_id, data.correlation_id, data.actor ?? null);
    });
}
