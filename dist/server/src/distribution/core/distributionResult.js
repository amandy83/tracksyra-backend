export function createDistributionResult(input) {
    return Object.freeze({
        jobId: input.jobId,
        provider: input.provider,
        status: input.status,
        attempts: input.attempts,
        providerReferenceId: input.providerReferenceId ?? null,
        manifestId: input.manifestId ?? null,
        checksum: input.checksum ?? null,
        nextRetryAt: input.nextRetryAt ?? null,
        completedAt: input.completedAt ?? new Date(),
        metadata: Object.freeze({ ...(input.metadata ?? {}) }),
        errors: Object.freeze([...(input.errors ?? [])]),
        rawResponse: input.rawResponse,
    });
}
