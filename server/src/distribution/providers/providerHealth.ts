import type { ProviderStatus } from "./providerStatus";

export type ProviderHealth = Readonly<{
  provider: string;
  version: string;
  status: ProviderStatus;
  healthy: boolean;
  checkedAt: Date;
  latencyMs: number | null;
  configurationValid: boolean;
  credentialsValid: boolean;
  message: string | null;
  checks: readonly { name: string; ok: boolean; message: string | null }[];
  metadata: Readonly<Record<string, unknown>>;
}>;

