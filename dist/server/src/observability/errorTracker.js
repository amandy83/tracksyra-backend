import { logger, serializeError } from "./logger.js";
import { loadRuntimeEnv } from "../config/envLoader.js";
export async function captureException(input) {
    const error = serializeError(input.error);
    logger.error("exception captured", { ...input.context, tags: input.tags, error });
    const dsn = readEnv("SENTRY_DSN");
    if (!dsn)
        return;
    try {
        await fetch(dsn, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                timestamp: new Date().toISOString(),
                platform: "node",
                level: "error",
                exception: error,
                tags: input.tags,
                contexts: { tracksyra: input.context },
            }),
        });
    }
    catch (sendError) {
        logger.warn("sentry-compatible error capture failed", { error: serializeError(sendError) });
    }
}
export function captureMessage(message, context = {}) {
    logger.warn(message, context);
}
function readEnv(name) {
    loadRuntimeEnv();
    return process.env[name];
}
