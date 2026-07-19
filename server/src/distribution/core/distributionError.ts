import { DistributionStatus } from "./distributionStatus";

export type DistributionErrorCode =
  | "INVALID_CONTEXT"
  | "INVALID_PACKAGE"
  | "PROVIDER_NOT_FOUND"
  | "PROVIDER_NOT_SUPPORTED"
  | "PROVIDER_FAILURE"
  | "RETRY_EXHAUSTED"
  | "UNEXPECTED_ERROR";

export type DistributionErrorDetails = {
  code: DistributionErrorCode;
  message: string;
  provider?: string | null;
  status?: DistributionStatus | null;
  retryable?: boolean;
  cause?: unknown;
  metadata?: Record<string, unknown>;
};

export class DistributionError extends Error {
  readonly code: DistributionErrorCode;
  readonly provider: string | null;
  readonly status: DistributionStatus | null;
  readonly retryable: boolean;
  readonly metadata: Record<string, unknown>;
  readonly cause?: unknown;

  constructor(details: DistributionErrorDetails) {
    super(details.message);
    this.name = "DistributionError";
    this.code = details.code;
    this.provider = details.provider ?? null;
    this.status = details.status ?? null;
    this.retryable = details.retryable ?? false;
    this.metadata = details.metadata ?? {};
    this.cause = details.cause;
  }

  static fromUnknown(error: unknown, fallback?: Omit<DistributionErrorDetails, "message"> & { message?: string }): DistributionError {
    if (error instanceof DistributionError) return error;
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

