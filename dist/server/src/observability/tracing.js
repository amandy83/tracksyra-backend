import { generateUUID } from "../../../src/lib/uuid.js";
export function createTraceContext(input = {}) {
    const traceId = input.traceId || generateUUID();
    return {
        traceId,
        correlationId: input.correlationId || traceId,
        actorUserId: input.actorUserId ?? null,
    };
}
export function traceFromHeaders(headers) {
    const traceId = headerValue(headers["x-trace-id"]) || headerValue(headers["traceparent"]) || generateUUID();
    return {
        traceId,
        correlationId: headerValue(headers["x-correlation-id"]) || traceId,
        actorUserId: headerValue(headers["x-actor-user-id"]) || null,
    };
}
function headerValue(value) {
    return Array.isArray(value) ? value[0] : value;
}
