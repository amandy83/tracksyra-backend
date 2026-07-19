export type DistributionJob = Readonly<{
  id: string;
  releaseId: string;
  trackId?: string | null;
  provider: string;
  attempt: number;
  maxAttempts: number;
  priority: number;
  scheduledAt: Date;
  correlationId?: string | null;
  traceId?: string | null;
}>;

export type DistributionJobInput = {
  id: string;
  releaseId: string;
  trackId?: string | null;
  provider: string;
  attempt?: number;
  maxAttempts?: number;
  priority?: number;
  scheduledAt?: Date;
  correlationId?: string | null;
  traceId?: string | null;
};

export function createDistributionJob(input: DistributionJobInput): DistributionJob {
  return Object.freeze({
    id: input.id,
    releaseId: input.releaseId,
    trackId: input.trackId ?? null,
    provider: input.provider,
    attempt: input.attempt ?? 0,
    maxAttempts: input.maxAttempts ?? 5,
    priority: input.priority ?? 0,
    scheduledAt: input.scheduledAt ?? new Date(),
    correlationId: input.correlationId ?? null,
    traceId: input.traceId ?? null,
  });
}

