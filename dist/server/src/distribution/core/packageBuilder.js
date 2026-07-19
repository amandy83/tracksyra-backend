export class DefaultPackageBuilder {
    assetCollector;
    metadataCollector;
    checksumGenerator;
    manifestGenerator;
    constructor(options) {
        this.assetCollector = options.assetCollector;
        this.metadataCollector = options.metadataCollector;
        this.checksumGenerator = options.checksumGenerator;
        this.manifestGenerator = options.manifestGenerator;
    }
    async build(context) {
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
