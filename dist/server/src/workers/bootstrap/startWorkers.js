import { loadRuntimeEnv, logRuntimeEnv } from "../../config/envLoader.js";
import { logFfmpegRuntime } from "../../media/services/ffmpeg.js";
import { startOperationsServer } from "../../http/operationsServer.js";
import { createDistributionBootstrapDependencies } from "../../distribution/composition/compositionRoot.js";
export async function startWorkers() {
    loadRuntimeEnv();
    logRuntimeEnv("worker-bootstrap");
    logFfmpegRuntime("worker-bootstrap");
    const bootstrap = await createDistributionBootstrapDependencies();
    const runtime = bootstrap.runtime;
    await runtime.startupHealthCheck();
    for (const scheduler of bootstrap.queueSchedulers) {
        void scheduler;
    }
    for (const registration of bootstrap.workerRegistrations) {
        runtime.register(registration);
    }
    runtime.startHeartbeat();
    runtime.installSignalHandlers();
    const operations = await startOperationsServer(bootstrap.operationsServerDependencies);
    const originalShutdown = runtime.shutdown.bind(runtime);
    runtime.shutdown = async () => {
        await operations.close();
        await originalShutdown();
    };
    bootstrap.logger.info("worker bootstrap complete", {
        component: "worker-bootstrap",
        workers: bootstrap.workerRegistrations.map((registration) => registration.name),
    });
    return runtime;
}
export const startAllWorkers = startWorkers;
export async function startEmailWorker(interval = 5000) {
    loadRuntimeEnv();
    const bootstrap = await createDistributionBootstrapDependencies({ emailWorkerIntervalMs: interval });
    const registration = bootstrap.emailWorkerRegistration;
    return {
        stop: async () => {
            await registration.stopDispatcher();
            await registration.worker.close();
        },
    };
}
if (isDirectExecution()) {
    void startWorkers().catch((error) => {
        console.error(error);
        const processRef = process;
        processRef?.exit?.(1);
    });
}
function isDirectExecution() {
    const processRef = process;
    const entry = processRef?.argv?.[1] || "";
    return entry.replace(/\\/g, "/").endsWith("server/src/workers/bootstrap/startWorkers.ts") || entry.replace(/\\/g, "/").endsWith("dist/server/src/workers/bootstrap/startWorkers.js");
}
