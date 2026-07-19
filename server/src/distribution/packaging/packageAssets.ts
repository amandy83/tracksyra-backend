import type { UniversalRelease } from "../metadata";
import type { PackageArtifact } from "./packageTypes";
import { PackageArtifactFactory } from "./packageArtifact";
import { PackageLayout } from "./packageLayout";
import { PackageMetadata } from "./packageMetadata";
import { normalizeArchivePath } from "./packageUtils";

export class PackageAssets {
  constructor(
    private readonly layout: PackageLayout,
    private readonly metadataFactory: (release: UniversalRelease) => PackageMetadata,
  ) {}

  build(release: UniversalRelease, additionalAssets: readonly PackageArtifact[] = []): readonly PackageArtifact[] {
    const metadata = this.metadataFactory(release);
    const paths = this.layout.paths();
    const assets: PackageArtifact[] = [
      PackageArtifactFactory.text(paths.release, "metadata", metadata.releaseJson(), "application/json"),
      PackageArtifactFactory.text(paths.tracks, "metadata", metadata.tracksJson(), "application/json"),
      PackageArtifactFactory.text(paths.contributors, "metadata", metadata.contributorsJson(), "application/json"),
      PackageArtifactFactory.text(paths.publishing, "metadata", metadata.publishingJson(), "application/json"),
      PackageArtifactFactory.text(paths.rights, "metadata", metadata.rightsJson(), "application/json"),
      PackageArtifactFactory.text(paths.territories, "metadata", metadata.territoriesJson(), "application/json"),
      PackageArtifactFactory.text(paths.pricing, "metadata", metadata.pricingJson(), "application/json"),
    ];

    for (const artifact of additionalAssets) {
      assets.push(Object.freeze({
        ...artifact,
        path: normalizeArchivePath(artifact.path),
      }));
    }

    return Object.freeze(assets);
  }
}
