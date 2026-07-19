import type { UniversalRelease } from "../metadata";
import type { PackageArtifact, PackageVersion } from "./packageTypes";
import { PackageAssets } from "./packageAssets";
import { PackageConfiguration } from "./packageConfiguration";
import { PackageContext } from "./packageContext";
import { PackageLayout } from "./packageLayout";
import { CURRENT_PACKAGE_VERSION } from "./packageVersion";
import { deepFreeze } from "./packageUtils";

export type PackageBuilderInput = Readonly<{
  packageId?: string;
  release?: UniversalRelease;
  outputPath?: string;
  workspacePath?: string;
  version?: PackageVersion;
  configuration?: PackageConfiguration;
  assets?: readonly PackageArtifact[];
}>;

export class PackageBuilder {
  private packageId: string | null = null;
  private release: UniversalRelease | null = null;
  private outputPath: string | null = null;
  private workspacePath: string | null = null;
  private version: PackageVersion = CURRENT_PACKAGE_VERSION;
  private configuration: PackageConfiguration | null = null;
  private assets: readonly PackageArtifact[] = [];

  constructor(
    private readonly assetBuilder: PackageAssets,
    private readonly layout: PackageLayout,
  ) {}

  static create(): PackageBuilder {
    throw new Error("PackageBuilder.create() is not supported; construct dependencies in the composition root");
  }

  fromRelease(release: UniversalRelease): this {
    this.release = release;
    return this;
  }

  withPackageId(packageId: string): this {
    this.packageId = packageId;
    return this;
  }

  withOutputPath(outputPath: string): this {
    this.outputPath = outputPath;
    return this;
  }

  withWorkspacePath(workspacePath: string): this {
    this.workspacePath = workspacePath;
    return this;
  }

  withVersion(version: PackageVersion): this {
    this.version = version;
    return this;
  }

  withConfiguration(configuration: PackageConfiguration): this {
    this.configuration = configuration;
    return this;
  }

  withAssets(assets: readonly PackageArtifact[]): this {
    this.assets = assets;
    return this;
  }

  build(): PackageContext {
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

  private requireConfiguration(): PackageConfiguration {
    if (!this.configuration) throw new Error("PackageBuilder requires a configuration before build()");
    return this.configuration;
  }

  private requireRelease(): UniversalRelease {
    if (!this.release) throw new Error("PackageBuilder requires a release before build()");
    return this.release;
  }
}
