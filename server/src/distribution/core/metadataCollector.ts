import type { DistributionContext } from "./distributionContext";

export type MetadataCollectorInput = {
  context: DistributionContext;
  extra?: Record<string, unknown>;
};

export class MetadataCollector {
  collect(input: MetadataCollectorInput): Record<string, unknown> {
    const { context } = input;
    const release = context.release;
    const track = context.track ?? undefined;

    return pruneUndefined({
      jobId: context.job.id,
      provider: context.provider,
      releaseId: release.id,
      trackId: track?.id ?? null,
      release: {
        title: release.title ?? null,
        primaryArtist: release.primaryArtist ?? null,
        featuredArtists: release.featuredArtists ?? [],
        variousArtists: Boolean(release.variousArtists),
        labelName: release.labelName ?? null,
        genre: release.genre ?? null,
        subgenre: release.subgenre ?? null,
        releaseDate: release.releaseDate ?? null,
        originalReleaseDate: release.originalReleaseDate ?? null,
        language: release.language ?? null,
        format: release.format ?? null,
        copyright: release.copyright ?? null,
        copyrightOwner: release.copyrightOwner ?? null,
        upc: release.upc ?? null,
        pLine: release.pLine ?? null,
        cLine: release.cLine ?? null,
      },
      track: track
        ? {
            title: track.title ?? null,
            version: track.version ?? null,
            primaryArtist: track.primaryArtist ?? null,
            featuredArtists: track.featuredArtists ?? [],
            genre: track.genre ?? null,
            subgenre: track.subgenre ?? null,
            secondaryGenre: track.secondaryGenre ?? null,
            secondarySubgenre: track.secondarySubgenre ?? null,
            isrc: track.isrc ?? null,
            explicit: Boolean(track.explicit),
            audioFormat: track.audioFormat ?? null,
            audioUrl: track.audioUrl ?? null,
            pLine: track.pLine ?? null,
            productionYear: track.productionYear ?? null,
            producerCatalogueNumber: track.producerCatalogueNumber ?? null,
          }
        : null,
      ...context.metadata,
      ...(input.extra ?? {}),
    });
  }
}

function pruneUndefined(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const result: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (entry === undefined) continue;
    if (entry && typeof entry === "object" && !Array.isArray(entry) && !(entry instanceof Date)) {
      const nested = pruneUndefined(entry);
      result[key] = Object.keys(nested).length > 0 ? nested : entry;
      continue;
    }
    result[key] = entry;
  }
  return result;
}

