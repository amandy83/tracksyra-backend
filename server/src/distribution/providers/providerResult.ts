import type { DistributionStatus } from "../core/distributionStatus";
import type { ProviderError } from "./providerError";
import type { ProviderHealth } from "./providerHealth";
import type { ProviderManifest } from "./providerManifest";
import type { ProviderStatus } from "./providerStatus";

export type ProviderResult = Readonly<{
  provider: string;
  version: string;
  operation: string;
  status: ProviderStatus;
  distributionStatus: DistributionStatus;
  manifest: ProviderManifest | null;
  referenceId: string | null;
  checksum: string | null;
  completedAt: Date;
  retryAt: Date | null;
  payload: unknown;
  health: ProviderHealth | null;
  metadata: Readonly<Record<string, unknown>>;
  errors: readonly ProviderError[];
}>;

export type ProviderResultInput = {
  provider: string;
  version: string;
  operation: string;
  status: ProviderStatus;
  distributionStatus: DistributionStatus;
  manifest?: ProviderManifest | null;
  referenceId?: string | null;
  checksum?: string | null;
  completedAt?: Date;
  retryAt?: Date | null;
  payload?: unknown;
  health?: ProviderHealth | null;
  metadata?: Record<string, unknown>;
  errors?: readonly ProviderError[];
};

export function createProviderResult(input: ProviderResultInput): ProviderResult {
  return Object.freeze({
    provider: input.provider,
    version: input.version,
    operation: input.operation,
    status: input.status,
    distributionStatus: input.distributionStatus,
    manifest: input.manifest ?? null,
    referenceId: input.referenceId ?? null,
    checksum: input.checksum ?? null,
    completedAt: input.completedAt ?? new Date(),
    retryAt: input.retryAt ?? null,
    payload: input.payload,
    health: input.health ?? null,
    metadata: Object.freeze({ ...(input.metadata ?? {}) }),
    errors: Object.freeze([...(input.errors ?? [])]),
  });
}

