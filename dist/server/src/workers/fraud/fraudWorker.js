import { createWorker } from "../../queue/queueFactory.js";
import { queueNames } from "../../queue/queueNames.js";
export function registerFraudWorker(engine, options = {}) {
    return createWorker(queueNames.fraud, async (job) => {
        const data = job.data;
        if (data.type === "STREAM_EVENT_SCORE" && data.streamEvent) {
            await engine.analyzeStreamEvent(data.streamEvent);
            return;
        }
        if (data.type === "ROYALTY_SPIKE_SCORE" && data.royaltySpike) {
            await engine.analyzeRoyaltySpike(data.royaltySpike);
            return;
        }
        if (data.type === "DISTRIBUTION_ANOMALY_SCORE" && data.distributionAnomaly) {
            await engine.analyzeDistributionAnomaly(data.distributionAnomaly);
        }
    }, { concurrency: options.concurrency });
}
