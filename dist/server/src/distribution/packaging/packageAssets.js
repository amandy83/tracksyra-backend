import { PackageArtifactFactory } from "./packageArtifact.js";
import { normalizeArchivePath } from "./packageUtils.js";
export class PackageAssets {
    layout;
    metadataFactory;
    constructor(layout, metadataFactory) {
        this.layout = layout;
        this.metadataFactory = metadataFactory;
    }
    build(release, additionalAssets = []) {
        const metadata = this.metadataFactory(release);
        const paths = this.layout.paths();
        const assets = [
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
