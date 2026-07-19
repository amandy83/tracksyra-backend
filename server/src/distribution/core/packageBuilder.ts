import type { DistributionContext } from "./distributionContext";
import type { DistributionJob } from "./distributionJob";
import type { DistributionManifest } from "./manifestGenerator";
import { AssetCollector } from "./assetCollector";
import { ChecksumGenerator } from "./checksumGenerator";
import { ManifestGenerator } from "./manifestGenerator";
import { MetadataCollector } from "./metadataCollector";

export type DistributionPackage = Readonly<{
  jobId: string;
  provider: string;
  releaseId: string;
  trackId: string | null;
  assets: readonly import("./distributionContext").DistributionAsset[];
  metadata: Readonly<Record<string, unknown>>;
  manifest: DistributionManifest;
  checksum: string;
}>;

export interface PackageBuilder {
  build(context: DistributionContext): Promise<DistributionPackage>;
}

export type DefaultPackageBuilderOptions = {
  assetCollector: AssetCollector;
  metadataCollector: MetadataCollector;
  checksumGenerator: ChecksumGenerator;
  manifestGenerator: ManifestGenerator;
};

export class DefaultPackageBuilder implements PackageBuilder {
  private readonly assetCollector: AssetCollector;
  private readonly metadataCollector: MetadataCollector;
  private readonly checksumGenerator: ChecksumGenerator;
  private readonly manifestGenerator: ManifestGenerator;

  constructor(options: DefaultPackageBuilderOptions) {
    this.assetCollector = options.assetCollector;
    this.metadataCollector = options.metadataCollector;
    this.checksumGenerator = options.checksumGenerator;
    this.manifestGenerator = options.manifestGenerator;
  }

  async build(context: DistributionContext): Promise<DistributionPackage> {
    const assets = this.assetCollector.collect({ context });
    const metadata = this.metadataCollector.collect({ context });
    const manifest = this.manifestGenerator.generate({
      job: context.job,
      context,
      assets,
      metadata,
    });
    const checksum = this.checksumGenerator.generateObject({
      jobId: context.job.id,
      provider: context.provider,
      releaseId: context.release.id,
      trackId: context.track?.id ?? null,
      metadata,
      assets,
      manifest,
    });

    return Object.freeze({
      jobId: context.job.id,
      provider: context.provider,
      releaseId: context.release.id,
      trackId: context.track?.id ?? null,
      assets,
      metadata,
      manifest,
      checksum,
    });
  }
}

export type { DistributionManifest } from "./manifestGenerator";
