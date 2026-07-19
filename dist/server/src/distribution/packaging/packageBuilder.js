import { PackageContext } from "./packageContext.js";
import { CURRENT_PACKAGE_VERSION } from "./packageVersion.js";
import { deepFreeze } from "./packageUtils.js";
export class PackageBuilder {
    assetBuilder;
    layout;
    packageId = null;
    release = null;
    outputPath = null;
    workspacePath = null;
    version = CURRENT_PACKAGE_VERSION;
    configuration = null;
    assets = [];
    constructor(assetBuilder, layout) {
        this.assetBuilder = assetBuilder;
        this.layout = layout;
    }
    static create() {
        throw new Error("PackageBuilder.create() is not supported; construct dependencies in the composition root");
    }
    fromRelease(release) {
        this.release = release;
        return this;
    }
    withPackageId(packageId) {
        this.packageId = packageId;
        return this;
    }
    withOutputPath(outputPath) {
        this.outputPath = outputPath;
        return this;
    }
    withWorkspacePath(workspacePath) {
        this.workspacePath = workspacePath;
        return this;
    }
    withVersion(version) {
        this.version = version;
        return this;
    }
    withConfiguration(configuration) {
        this.configuration = configuration;
        return this;
    }
    withAssets(assets) {
        this.assets = assets;
        return this;
    }
    build() {
        const release = this.requireRelease();
        const configuration = this.requireConfiguration();
        const context = new PackageContext({
            packageId: this.packageId ?? release.id,
            release,
            outputPath: this.outputPath ?? `${this.layout.paths().root}.zip`,
            workspacePath: this.workspacePath ?? this.layout.paths().root,
            version: this.version,
            artifacts: this.assetBuilder.build(release, this.assets),
            configuration,
        });
        return deepFreeze(context);
    }
    requireConfiguration() {
        if (!this.configuration)
            throw new Error("PackageBuilder requires a configuration before build()");
        return this.configuration;
    }
    requireRelease() {
        if (!this.release)
            throw new Error("PackageBuilder requires a release before build()");
        return this.release;
    }
}
