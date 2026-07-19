import type { DistributionError } from "./distributionError";
import { DistributionStatus } from "./distributionStatus";

export type DistributionResult = Readonly<{
  jobId: string;
  provider: string;
  status: DistributionStatus;
  attempts: number;
  providerReferenceId: string | null;
  manifestId: string | null;
  checksum: string | null;
  nextRetryAt: Date | null;
  completedAt: Date;
  metadata: Readonly<Record<string, unknown>>;
  errors: readonly DistributionError[];
  rawResponse: unknown;
}>;

export type DistributionResultInput = {
  jobId: string;
  provider: string;
  status: DistributionStatus;
  attempts: number;
  providerReferenceId?: string | null;
  manifestId?: string | null;
  checksum?: string | null;
  nextRetryAt?: Date | null;
  completedAt?: Date;
  metadata?: Record<string, unknown>;
  errors?: readonly DistributionError[];
  rawResponse?: unknown;
};

export function createDistributionResult(input: DistributionResultInput): DistributionResult {
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

