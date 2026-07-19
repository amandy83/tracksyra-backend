import { QueueEnvelope } from "../types/queueIntegrationTypes.js";
export class BullMQQueueDeserializer {
    deserialize(value) {
        return JSON.parse(value);
    }
    deserializeEnvelope(value) {
        const raw = JSON.parse(value);
        return new QueueEnvelope({
            messageId: String(raw.messageId ?? ""),
            type: String(raw.type ?? ""),
            body: raw.body,
            headers: isRecord(raw.headers) ? raw.headers : {},
            attributes: isRecord(raw.attributes) ? raw.attributes : {},
            timestamp: typeof raw.timestamp === "string" ? raw.timestamp : undefined,
            lease: null,
            retryContext: null,
            tracing: isRecord(raw.tracing)
                ? {
                    traceId: String(raw.tracing.traceId ?? ""),
                    correlationId: String(raw.tracing.correlationId ?? ""),
                    parentSpanId: raw.tracing.parentSpanId === null ? null : String(raw.tracing.parentSpanId ?? ""),
                    spanId: String(raw.tracing.spanId ?? ""),
                }
                : { traceId: "", correlationId: "", parentSpanId: null, spanId: "" },
            metadata: isRecord(raw.metadata) ? raw.metadata : {},
            deliveryAttempt: typeof raw.deliveryAttempt === "number" ? raw.deliveryAttempt : 0,
            scheduledAt: typeof raw.scheduledAt === "string" ? raw.scheduledAt : null,
        });
    }
}
function isRecord(value) {
    return typeof value === "object" && value !== null;
}
