import { QueueEnvelope } from "../types/queueIntegrationTypes";
import type { QueueDeserializer } from "../deserializer/queueDeserializer";

export class BullMQQueueDeserializer implements QueueDeserializer {
  deserialize<T>(value: string): T {
    return JSON.parse(value) as T;
  }

  deserializeEnvelope(value: string): QueueEnvelope {
    const raw = JSON.parse(value) as Record<string, unknown>;
    return new QueueEnvelope({
      messageId: String(raw.messageId ?? ""),
      type: String(raw.type ?? ""),
      body: raw.body,
      headers: isRecord(raw.headers) ? (raw.headers as Readonly<Record<string, string>>) : {},
      attributes: isRecord(raw.attributes) ? (raw.attributes as Readonly<Record<string, string | number | boolean | null>>) : {},
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
