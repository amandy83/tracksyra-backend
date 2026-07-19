export class DistributionError extends Error {
    code;
    provider;
    status;
    retryable;
    metadata;
    cause;
    constructor(details) {
        super(details.message);
        this.name = "DistributionError";
        this.code = details.code;
        this.provider = details.provider ?? null;
        this.status = details.status ?? null;
        this.retryable = details.retryable ?? false;
        this.metadata = details.metadata ?? {};
        this.cause = details.cause;
    }
    static fromUnknown(error, fallback) {
        if (error instanceof DistributionError)
            return error;
        if (error instanceof Error) {
            return new DistributionError({
                code: fallback?.code ?? "UNEXPECTED_ERROR",
                message: fallback?.message ?? error.message,
                provider: fallback?.provider ?? null,
                status: fallback?.status ?? null,
                retryable: fallback?.retryable ?? false,
                cause: error,
                metadata: fallback?.metadata,
            });
        }
        return new DistributionError({
            code: fallback?.code ?? "UNEXPECTED_ERROR",
            message: fallback?.message ?? String(error),
            provider: fallback?.provider ?? null,
            status: fallback?.status ?? null,
            retryable: fallback?.retryable ?? false,
            cause: error,
            metadata: fallback?.metadata,
        });
    }
}
