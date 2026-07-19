import type { ConnectorMetadataMap } from "../types/connectorTypes";

export class ConnectorRetry {
  readonly [key: string]: unknown;
  readonly connectorId: string;
  readonly releaseId: string;
  readonly retryCount: number;
  readonly lastAttemptAt: string | null;
  readonly nextAttemptAt: string | null;
  readonly metadata: ConnectorMetadataMap;

  constructor(input: {
    connectorId: string;
    releaseId: string;
    retryCount?: number;
    lastAttemptAt?: string | null;
    nextAttemptAt?: string | null;
    metadata?: ConnectorMetadataMap;
  }) {
    this.connectorId = input.connectorId.trim();
    this.releaseId = input.releaseId.trim();
    this.retryCount = input.retryCount ?? 0;
    this.lastAttemptAt = input.lastAttemptAt ?? null;
    this.nextAttemptAt = input.nextAttemptAt ?? null;
    this.metadata = Object.freeze({ ...(input.metadata ?? {}) });
    if (!this.connectorId || !this.releaseId) {
      throw new Error("ConnectorRetry requires non-empty identifiers");
    }
    if (!Number.isInteger(this.retryCount) || this.retryCount < 0) {
      throw new Error("ConnectorRetry.retryCount must be a non-negative integer");
    }
    Object.freeze(this);
  }
}

export interface RetryProvider {
  shouldRetry(error: unknown, attempt: number): boolean;
  nextRetryAt(error: unknown, attempt: number): string | null;
}
