import type { DistributionAsset, DistributionContext } from "./distributionContext";
import type { DistributionJob } from "./distributionJob";
import { ChecksumGenerator } from "./checksumGenerator";

export type DistributionManifestAsset = Readonly<{
  name: string;
  kind: string;
  url: string | null;
  path: string | null;
  contentType: string | null;
  sizeBytes: number | null;
  checksum: string | null;
}>;

export type DistributionManifest = Readonly<{
  id: string;
  jobId: string;
  releaseId: string;
  trackId: string | null;
  provider: string;
  generatedAt: string;
  checksum: string;
  assets: readonly DistributionManifestAsset[];
  metadata: Readonly<Record<string, unknown>>;
}>;

export type ManifestGeneratorInput = {
  job: DistributionJob;
  context: DistributionContext;
  assets: readonly DistributionAsset[];
  metadata: Record<string, unknown>;
};

export class ManifestGenerator {
  constructor(private readonly checksumGenerator = new ChecksumGenerator()) {}

  generate(input: ManifestGeneratorInput): DistributionManifest {
    const manifest: DistributionManifest = Object.freeze({
      id: `manifest_${input.job.id}`,
      jobId: input.job.id,
      releaseId: input.context.release.id,
      trackId: input.context.track?.id ?? null,
      provider: input.context.provider,
      generatedAt: new Date().toISOString(),
      checksum: "",
      assets: input.assets.map((asset) => this.mapAsset(asset)),
      metadata: Object.freeze({ ...input.metadata }),
    });

    const checksum = this.checksumGenerator.generateObject({
      id: manifest.id,
      jobId: manifest.jobId,
      releaseId: manifest.releaseId,
      trackId: manifest.trackId,
      provider: manifest.provider,
      generatedAt: manifest.generatedAt,
      assets: manifest.assets,
      metadata: manifest.metadata,
    });

    return Object.freeze({
      ...manifest,
      checksum,
    });
  }

  private mapAsset(asset: DistributionAsset): DistributionManifestAsset {
    return Object.freeze({
      name: asset.name,
      kind: asset.kind,
      url: asset.url,
      path: asset.path,
      contentType: asset.contentType,
      sizeBytes: asset.sizeBytes,
      checksum: asset.checksum,
    });
  }
}

