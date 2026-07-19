export class TooLostStageError extends Error {
    stage;
    cause;
    constructor(stage, error) {
        super(error instanceof Error ? error.message : String(error));
        this.name = "TooLostStageError";
        this.stage = stage;
        this.cause = error;
        if (error instanceof Error && error.stack) {
            this.stack = error.stack;
        }
    }
}
export function normalizeTooLostError(error, platform = "too_lost") {
    if (isTooLostError(error))
        return error;
    const status = typeof error === "object" && error && "status" in error ? Number(error.status) : null;
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
export function isTooLostError(error) {
    return Boolean(error &&
        typeof error === "object" &&
        "errorCode" in error &&
        "message" in error &&
        "retryable" in error &&
        error.provider === "too_lost");
}
export function isTooLostStageError(error) {
    return Boolean(error && typeof error === "object" && "stage" in error && typeof error.stage === "string");
}
export function rethrowTooLostStageError(stage, error) {
    if (isTooLostStageError(error))
        throw error;
    throw new TooLostStageError(stage, error);
}
