export function createDistributionContext(input) {
    return Object.freeze({
        job: input.job,
        release: input.release,
        track: input.track ?? null,
        provider: input.provider ?? input.job.provider,
        requestedAt: input.requestedAt ?? new Date(),
        metadata: Object.freeze({ ...(input.metadata ?? {}) }),
        assetInputs: Object.freeze([...(input.assetInputs ?? [])]),
        manifest: input.manifest ?? null,
        correlationId: input.correlationId ?? input.job.correlationId ?? null,
        traceId: input.traceId ?? input.job.traceId ?? null,
    });
}
