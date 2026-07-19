import { ProviderStatus } from "./providerStatus";

export type ProviderErrorCode =
  | "INVALID_CONFIGURATION"
  | "INVALID_CREDENTIALS"
  | "INVALID_CONTEXT"
  | "INVALID_MANIFEST"
  | "INVALID_PAYLOAD"
  | "VALIDATION_FAILED"
  | "AUTHENTICATION_FAILED"
  | "SUBMISSION_FAILED"
  | "WEBHOOK_FAILED"
  | "NOT_SUPPORTED"
  | "NOT_FOUND"
  | "RATE_LIMITED"
  | "UNAVAILABLE"
  | "UNEXPECTED_ERROR";

export type ProviderErrorDetails = {
  code: ProviderErrorCode;
  message: string;
  provider: string;
  version?: string | null;
  status?: ProviderStatus | null;
  retryable?: boolean;
  metadata?: Record<string, unknown>;
  cause?: unknown;
};

export class ProviderError extends Error {
  readonly code: ProviderErrorCode;
  readonly provider: string;
  readonly version: string | null;
  readonly status: ProviderStatus | null;
  readonly retryable: boolean;
  readonly metadata: Readonly<Record<string, unknown>>;
  readonly cause?: unknown;

  constructor(details: ProviderErrorDetails) {
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

  static fromUnknown(error: unknown, provider: string, version?: string | null, fallback?: Partial<ProviderErrorDetails>): ProviderError {
    if (error instanceof ProviderError) return error;
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

