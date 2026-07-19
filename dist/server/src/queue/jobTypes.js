export function createJobTrace(input) {
    const now = new Date().toISOString();
    const traceId = input.traceId || input.correlationId || input.idempotencyKey;
    return {
        traceId,
        correlationId: input.correlationId || traceId,
        actorUserId: input.actorUserId ?? null,
        sourceSystem: input.sourceSystem || "system",
        createdAt: input.createdAt || now,
        idempotencyKey: input.idempotencyKey,
    };
}
