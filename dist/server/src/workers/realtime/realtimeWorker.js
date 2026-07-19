import { createWorker } from "../../queue/queueFactory.js";
import { queueNames } from "../../queue/queueNames.js";
export function registerRealtimeWorker(deps, options = {}) {
    return createWorker(queueNames.realtime, async (job) => {
        const data = job.data;
        if (data.type === "PUBLISH_EVENT" && data.event) {
            await deps.eventBus?.publish(data.event);
            return;
        }
        if (data.type === "DASHBOARD_SNAPSHOT_REFRESH" && data.artistId) {
            await deps.liveDashboardService?.publishSnapshot(data.artistId);
        }
    }, { concurrency: options.concurrency });
}
