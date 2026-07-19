import type { Release, Track } from "../models/distributionTypes";
import type { DistributionJob } from "./distributionJob";
import type { DistributionManifest } from "./manifestGenerator";

export type DistributionAssetInput = {
  name: string;
  kind: "audio" | "artwork" | "metadata" | "manifest" | string;
  path?: string | null;
  url?: string | null;
  contentType?: string | null;
  sizeBytes?: number | null;
  checksum?: string | null;
  data?: string | Uint8Array | Buffer | null;
  metadata?: Record<string, unknown>;
};

export type DistributionAsset = Readonly<{
  name: string;
  kind: string;
  path: string | null;
  url: string | null;
  contentType: string | null;
  sizeBytes: number | null;
  checksum: string | null;
  metadata: Readonly<Record<string, unknown>>;
}>;

export type DistributionContext = Readonly<{
  job: DistributionJob;
  release: Release;
  track?: Track | null;
  provider: string;
  requestedAt: Date;
  metadata: Readonly<Record<string, unknown>>;
  assetInputs: readonly DistributionAssetInput[];
  manifest?: DistributionManifest | null;
  correlationId?: string | null;
  traceId?: string | null;
}>;

export type DistributionContextInput = {
  job: DistributionJob;
  release: Release;
  track?: Track | null;
  provider?: string;
  requestedAt?: Date;
  metadata?: Record<string, unknown>;
  assetInputs?: readonly DistributionAssetInput[];
  manifest?: DistributionManifest | null;
  correlationId?: string | null;
  traceId?: string | null;
};

export function createDistributionContext(input: DistributionContextInput): DistributionContext {
  return Object.freeze({
    job: input.job,
    release: input.release,
    track: input.track ?? null,
    provider: input.provider ?? input.job.provider,
    requestedAt: input.requestedAt ?? new Date(),
    metadata: Object.freeze({ ...(input.metadata ?? {}) }),
    assetInputs: Object.freeze([...((input.assetInputs ?? []) as readonly DistributionAssetInput[])]),
    manifest: input.manifest ?? null,
    correlationId: input.correlationId ?? input.job.correlationId ?? null,
    traceId: input.traceId ?? input.job.traceId ?? null,
  });
}

