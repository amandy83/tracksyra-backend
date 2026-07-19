import type { ProviderFeatureFlags } from "./providerFeatureFlags";
import type { ProviderRateLimit } from "./providerRateLimit";

export type ProviderConfiguration = Readonly<{
  provider: string;
  version: string;
  enabled: boolean;
  priority: number;
  fallbackProvider: string | null;
  timeoutMs: number;
  healthCheckIntervalMs: number;
  featureFlags: ProviderFeatureFlags;
  rateLimit?: ProviderRateLimit | null;
  endpoint?: string | null;
  metadata: Readonly<Record<string, unknown>>;
}>;

