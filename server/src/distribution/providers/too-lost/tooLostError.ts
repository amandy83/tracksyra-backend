import type { DistributionPlatformName } from "../../models/distributionTypes";
import type { TooLostError } from "./tooLostTypes";

export type TooLostStage = string;

export class TooLostStageError extends Error {
  readonly stage: TooLostStage;
  readonly cause: unknown;

  constructor(stage: TooLostStage, error: unknown) {
    super(error instanceof Error ? error.message : String(error));
    this.name = "TooLostStageError";
    this.stage = stage;
    this.cause = error;
    if (error instanceof Error && error.stack) {
      this.stack = error.stack;
    }
  }
}

export function normalizeTooLostError(error: unknown, platform: DistributionPlatformName = "too_lost"): TooLostError {
  if (isTooLostError(error)) return error;

  const status = typeof error === "object" && error && "status" in error ? Number((error as { status?: number }).status) : null;
  const message = error instanceof Error ? error.message : String(error);

  if (status === 401 || status === 403) {
    return { errorCode: "AUTH_ERROR", message: "Too Lost authentication failed", platform, provider: "too_lost", retryable: false };
  }

  if (status === 400 || status === 422) {
    return { errorCode: "VALIDATION_ERROR", message, platform, provider: "too_lost", retryable: false };
  }

  if (status === 429) {
    return { errorCode: "RATE_LIMIT_ERROR", message, platform, provider: "too_lost", retryable: true };
  }

  return { errorCode: "NETWORK_ERROR", message, platform, provider: "too_lost", retryable: true };
}

export function isTooLostError(error: unknown): error is TooLostError {
  return Boolean(
    error &&
      typeof error === "object" &&
      "errorCode" in error &&
      "message" in error &&
      "retryable" in error &&
      (error as { provider?: unknown }).provider === "too_lost",
  );
}

export function isTooLostStageError(error: unknown): error is TooLostStageError {
  return Boolean(error && typeof error === "object" && "stage" in error && typeof (error as { stage?: unknown }).stage === "string");
}

export function rethrowTooLostStageError(stage: TooLostStage, error: unknown): never {
  if (isTooLostStageError(error)) throw error;
  throw new TooLostStageError(stage, error);
}
