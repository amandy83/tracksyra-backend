import type { DistributionAsset, DistributionAssetInput, DistributionContext } from "./distributionContext";

export type AssetCollectorInput = {
  context: DistributionContext;
  additionalAssets?: readonly DistributionAssetInput[];
};

export class AssetCollector {
  collect(input: AssetCollectorInput): DistributionAsset[] {
    const assets: DistributionAsset[] = [];
    const { context } = input;

    if (context.release.coverArtUrl) {
      assets.push(this.normalize({
        name: `${context.release.id}-cover`,
        kind: "artwork",
        url: context.release.coverArtUrl,
        contentType: "image/*",
        metadata: { scope: "release", releaseId: context.release.id },
      }));
    }

    if (context.track?.audioUrl) {
      assets.push(this.normalize({
        name: `${context.track.id}-audio`,
        kind: "audio",
        url: context.track.audioUrl,
        contentType: context.track.audioFormat ?? "audio/*",
        metadata: { scope: "track", releaseId: context.release.id, trackId: context.track.id },
      }));
    }

    for (const asset of [...context.assetInputs, ...(input.additionalAssets ?? [])]) {
      assets.push(this.normalize(asset));
    }

    return dedupeAssets(assets);
  }

  private normalize(asset: DistributionAssetInput): DistributionAsset {
    return Object.freeze({
      name: asset.name.trim(),
      kind: asset.kind,
      path: asset.path ?? null,
      url: asset.url ?? null,
      contentType: asset.contentType ?? null,
      sizeBytes: typeof asset.sizeBytes === "number" && Number.isFinite(asset.sizeBytes) ? asset.sizeBytes : null,
      checksum: asset.checksum ?? null,
      metadata: Object.freeze({ ...(asset.metadata ?? {}) }),
    });
  }
}

function dedupeAssets(assets: DistributionAsset[]): DistributionAsset[] {
  const seen = new Set<string>();
  const result: DistributionAsset[] = [];

  for (const asset of assets) {
    const key = [asset.kind, asset.name, asset.path ?? "", asset.url ?? ""].join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(asset);
  }

  return result;
}

