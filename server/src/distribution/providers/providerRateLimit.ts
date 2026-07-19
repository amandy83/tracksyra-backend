export type ProviderRateLimit = Readonly<{
  requestsPerSecond: number;
  burst?: number | null;
  concurrency?: number | null;
  windowMs?: number | null;
  retryAfterHeader?: string | null;
  dailyLimit?: number | null;
}>;

