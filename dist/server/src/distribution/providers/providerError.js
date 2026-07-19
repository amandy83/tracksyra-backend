export class ProviderError extends Error {
    code;
    provider;
    version;
    status;
    retryable;
    metadata;
    cause;
    constructor(details) {
        super(details.message);
        this.name = "ProviderError";
        this.code = details.code;
        this.provider = details.provider;
        this.version = details.version ?? null;
        this.status = details.status ?? null;
        this.retryable = details.retryable ?? false;
        this.metadata = Object.freeze({ ...(details.metadata ?? {}) });
        this.cause = details.cause;
    }
    static fromUnknown(error, provider, version, fallback) {
        if (error instanceof ProviderError)
            return error;
        if (error instanceof Error) {
            return new ProviderError({
                code: fallback?.code ?? "UNEXPECTED_ERROR",
                message: fallback?.message ?? error.message,
                provider,
                version: version ?? fallback?.version ?? null,
                status: fallback?.status ?? null,
                retryable: fallback?.retryable ?? false,
                metadata: fallback?.metadata,
                cause: error,
            });
        }
        return new ProviderError({
            code: fallback?.code ?? "UNEXPECTED_ERROR",
            message: fallback?.message ?? String(error),
            provider,
            version: version ?? fallback?.version ?? null,
            status: fallback?.status ?? null,
            retryable: fallback?.retryable ?? false,
            metadata: fallback?.metadata,
            cause: error,
        });
    }
}
