export function createProviderResult(input) {
    return Object.freeze({
        provider: input.provider,
        version: input.version,
        operation: input.operation,
        status: input.status,
        distributionStatus: input.distributionStatus,
        manifest: input.manifest ?? null,
        referenceId: input.referenceId ?? null,
        checksum: input.checksum ?? null,
        completedAt: input.completedAt ?? new Date(),
        retryAt: input.retryAt ?? null,
        payload: input.payload,
        health: input.health ?? null,
        metadata: Object.freeze({ ...(input.metadata ?? {}) }),
        errors: Object.freeze([...(input.errors ?? [])]),
    });
}
