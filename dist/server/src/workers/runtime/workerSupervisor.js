import { logger } from "../../observability/logger.js";
import { captureException } from "../../observability/errorTracker.js";
export class WorkerSupervisor {
    options;
    heartbeatTimer = null;
    registrations = [];
    constructor(options = {}) {
        this.options = options;
    }
    register(registration) {
        this.registrations.push(registration);
        logger.info("worker supervised", { component: "worker-supervisor", worker: registration.name });
    }
    start() {
        if (this.heartbeatTimer)
            return;
        this.heartbeatTimer = setInterval(() => {
            for (const registration of this.registrations) {
                logger.info("worker heartbeat", {
                    component: "worker-supervisor",
                    worker: registration.name,
                    timestamp: new Date().toISOString(),
                });
            }
        }, this.options.heartbeatIntervalMs ?? 30_000);
    }
    async stop() {
        if (this.heartbeatTimer)
            clearInterval(this.heartbeatTimer);
        this.heartbeatTimer = null;
    }
    async isolateRetry(name, operation) {
        try {
            return await operation();
        }
        catch (error) {
            await captureException({
                error,
                context: { component: "worker-supervisor", worker: name },
                tags: { worker: name },
            });
            throw error;
        }
    }
}
