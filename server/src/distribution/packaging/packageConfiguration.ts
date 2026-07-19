import type { PackageCompressionKind, PackageEncryptionKind, PackageVersion } from "./packageTypes";
import { CURRENT_PACKAGE_VERSION } from "./packageVersion";
import { deepFreeze } from "./packageUtils";

export type PackageConfigurationInput = Readonly<{
  version?: PackageVersion;
  compression?: PackageCompressionKind;
  encryption?: PackageEncryptionKind;
  workspaceRoot?: string;
  outputRoot?: string;
  cleanupTemporaryWorkspace?: boolean;
  resumeInterrupted?: boolean;
  concurrentAssets?: number;
  maxFileSizeBytes?: number;
  signed?: boolean;
  metadata?: Record<string, unknown>;
}>;

export class PackageConfiguration {
  readonly version: PackageVersion;
  readonly compression: PackageCompressionKind;
  readonly encryption: PackageEncryptionKind;
  readonly workspaceRoot: string | null;
  readonly outputRoot: string | null;
  readonly cleanupTemporaryWorkspace: boolean;
  readonly resumeInterrupted: boolean;
  readonly concurrentAssets: number;
  readonly maxFileSizeBytes: number;
  readonly signed: boolean;
  readonly metadata: Readonly<Record<string, unknown>>;

  constructor(input: PackageConfigurationInput = {}) {
    this.version = input.version ?? CURRENT_PACKAGE_VERSION;
    this.compression = input.compression ?? "store";
    this.encryption = input.encryption ?? "none";
    this.workspaceRoot = input.workspaceRoot ?? null;
    this.outputRoot = input.outputRoot ?? null;
    this.cleanupTemporaryWorkspace = input.cleanupTemporaryWorkspace ?? true;
    this.resumeInterrupted = input.resumeInterrupted ?? true;
    this.concurrentAssets = Math.max(1, Math.trunc(input.concurrentAssets ?? 4));
    this.maxFileSizeBytes = Math.max(1, Math.trunc(input.maxFileSizeBytes ?? 10 * 1024 * 1024 * 1024));
    this.signed = input.signed ?? false;
    this.metadata = deepFreeze({ ...(input.metadata ?? {}) });
    Object.freeze(this);
  }
}

