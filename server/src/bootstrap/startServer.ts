import { loadRuntimeEnv, logRuntimeEnv } from "../config/envLoader";
import { logFfmpegRuntime } from "../media/services/ffmpeg";
import { startOperationsServer } from "../http/operationsServer";
import { createDistributionBootstrapDependencies } from "../distribution/composition/compositionRoot";

export async function startServer() {
  loadRuntimeEnv();
  logRuntimeEnv("server-bootstrap");
  logFfmpegRuntime("server-bootstrap");

  const bootstrap = await createDistributionBootstrapDependencies();
  const operations = await startOperationsServer(bootstrap.operationsServerDependencies);
  void bootstrap.runtime.startupHealthCheck().catch((error) => {
    bootstrap.logger.warn("worker runtime startup health check failed", {
      component: "server-bootstrap",
      error: error instanceof Error ? { message: error.message, stack: error.stack } : { message: String(error) },
    });
  });
  void bootstrap.operationsServerDependencies.tooLostCredentialStore.refreshConnectionStatus("bootstrap").catch((error) => {
    bootstrap.logger.warn("Too Lost status cache bootstrap refresh failed", {
      component: "server-bootstrap",
      error: error instanceof Error ? { message: error.message, stack: error.stack } : { message: String(error) },
    });
  });

  bootstrap.logger.info("server bootstrap complete", {
    component: "server-bootstrap",
    port: Number(process.env.WORKER_HTTP_PORT || process.env.PORT || 3000),
  });

  const originalShutdown = bootstrap.runtime.shutdown.bind(bootstrap.runtime);
  const shutdown = async () => {
    await operations.close();
    await originalShutdown();
  };

  process.once("SIGINT", () => {
    void shutdown().finally(() => process.exit(130));
  });
  process.once("SIGTERM", () => {
    void shutdown().finally(() => process.exit(143));
  });

  return { operations, bootstrap };
}

if (isDirectExecution()) {
  void startServer().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

function isDirectExecution() {
  const entry = process.argv[1] || "";
  return entry.replace(/\\/g, "/").endsWith("server/src/bootstrap/startServer.ts");
}
