export function createDistributionJob(input) {
    return Object.freeze({
        id: input.id,
        releaseId: input.releaseId,
        trackId: input.trackId ?? null,
        provider: input.provider,
        attempt: input.attempt ?? 0,
        maxAttempts: input.maxAttempts ?? 5,
        priority: input.priority ?? 0,
        scheduledAt: input.scheduledAt ?? new Date(),
        correlationId: input.correlationId ?? null,
        traceId: input.traceId ?? null,
    });
}
