import type { UniversalRelease } from "../metadata";
import type { PackageArtifact, PackageCompressionKind, PackageEncryptionKind, PackageVersion } from "./packageTypes";
import { PackageConfiguration } from "./packageConfiguration";
import { deepFreeze } from "./packageUtils";

export class PackageContext {
  readonly packageId: string;
  readonly release: UniversalRelease;
  readonly outputPath: string;
  readonly workspacePath: string;
  readonly version: PackageVersion;
  readonly compression: PackageCompressionKind;
  readonly encryption: PackageEncryptionKind;
  readonly signed: boolean;
  readonly metadata: Readonly<Record<string, unknown>>;
  readonly artifacts: readonly PackageArtifact[];
  readonly configuration: PackageConfiguration;

  constructor(input: {
    packageId: string;
    release: UniversalRelease;
    outputPath: string;
    workspacePath: string;
    version: PackageVersion;
    configuration: PackageConfiguration;
    compression?: PackageCompressionKind;
    encryption?: PackageEncryptionKind;
    signed?: boolean;
    metadata?: Record<string, unknown>;
    artifacts?: readonly PackageArtifact[];
  }) {
    this.packageId = input.packageId;
    this.release = input.release;
    this.outputPath = input.outputPath;
    this.workspacePath = input.workspacePath;
    this.version = input.version;
    this.compression = input.compression ?? "store";
    this.encryption = input.encryption ?? "none";
    this.signed = input.signed ?? false;
    this.metadata = deepFreeze({ ...(input.metadata ?? {}) });
    this.artifacts = Object.freeze([...(input.artifacts ?? [])]);
    this.configuration = input.configuration;
    Object.freeze(this);
  }
}
