import { createWorker } from "../../queue/queueFactory.js";
import { queueNames } from "../../queue/queueNames.js";
export function registerAnalyticsWorker(deps, options = {}) {
    return createWorker(queueNames.analytics, async (job) => {
        const data = job.data;
        if (data.type === "STREAM_ANALYTICS_REFRESH")
            await deps.streamAnalyticsService?.persistSnapshot();
        if (data.type === "REVENUE_ANALYTICS_REFRESH")
            await deps.revenueAnalyticsService?.persistSnapshot();
        if (data.type === "FRAUD_ANALYTICS_REFRESH")
            await deps.fraudAnalyticsService?.persistSnapshot();
        if (data.type === "DISTRIBUTION_ANALYTICS_REFRESH" && data.platform) {
            await deps.distributionAnalyticsService?.refreshPlatformMetrics(data.platform);
        }
    }, { concurrency: options.concurrency });
}
