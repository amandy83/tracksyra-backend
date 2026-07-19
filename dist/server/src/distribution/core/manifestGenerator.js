import { ChecksumGenerator } from "./checksumGenerator.js";
export class ManifestGenerator {
    checksumGenerator;
    constructor(checksumGenerator = new ChecksumGenerator()) {
        this.checksumGenerator = checksumGenerator;
    }
    generate(input) {
        const manifest = Object.freeze({
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
    mapAsset(asset) {
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
