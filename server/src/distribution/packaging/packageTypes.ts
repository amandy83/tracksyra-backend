import type { Readable } from "node:stream";
import type { UniversalRelease } from "../metadata";

export const PACKAGE_VERSIONS = ["1.0"] as const;
export type PackageVersion = (typeof PACKAGE_VERSIONS)[number];

export type PackageCompressionKind = "store" | "deflate";
export type PackageEncryptionKind = "none" | "aes-256-gcm";

export type PackageArtifactKind =
  | "metadata"
  | "audio"
  | "artwork"
  | "lyrics"
  | "checksum"
  | "fingerprint"
  | "audit"
  | "manifest"
  | "package";

export type PackageSource =
  | Readonly<{ type: "file"; path: string }>
  | Readonly<{ type: "stream"; stream: () => Readable }>
  | Readonly<{ type: "buffer"; buffer: Buffer }>
  | Readonly<{ type: "text"; text: string }>;

export type PackageArtifact = Readonly<{
  path: string;
  kind: PackageArtifactKind;
  source: PackageSource;
  mediaType: string | null;
  size: number | null;
  checksum: string | null;
  metadata: Readonly<Record<string, unknown>>;
}>;

export type PackageFileEntry = Readonly<{
  path: string;
  kind: PackageArtifactKind;
  size: number;
  checksum: string;
  mediaType: string | null;
}>;

export type PackageManifestDocument = Readonly<{
  version: PackageVersion;
  packageId: string;
  releaseId: string;
  fingerprint: string;
  createdAt: string;
  files: readonly PackageFileEntry[];
  metadata: Readonly<Record<string, unknown>>;
}>;

export type PackageSnapshotDocument = Readonly<{
  id: string;
  version: PackageVersion;
  packageId: string;
  releaseId: string;
  fingerprint: string;
  createdAt: string;
  serialized: string;
  manifest: PackageManifestDocument;
  metadata: Readonly<Record<string, unknown>>;
}>;

export type PackageDiffEntry = Readonly<{
  path: string;
  before: unknown;
  after: unknown;
  changeType: "added" | "removed" | "changed";
}>;

export type PackageDiffDocument = Readonly<{
  identical: boolean;
  changes: readonly PackageDiffEntry[];
  beforeFingerprint: string | null;
  afterFingerprint: string | null;
  metadata: Readonly<Record<string, unknown>>;
}>;

export type PackageIntegrityDocument = Readonly<{
  valid: boolean;
  filesVerified: number;
  bytesVerified: number;
  errors: readonly string[];
  metadata: Readonly<Record<string, unknown>>;
}>;

export type PackageAuditDocument = Readonly<{
  id: string;
  packageId: string;
  releaseId: string;
  snapshotId: string;
  fingerprint: string;
  createdAt: string;
  diff: PackageDiffDocument | null;
  metadata: Readonly<Record<string, unknown>>;
}>;

export type PackageLayoutPaths = Readonly<{
  root: string;
  manifest: string;
  metadata: string;
  release: string;
  tracks: string;
  contributors: string;
  publishing: string;
  rights: string;
  territories: string;
  pricing: string;
  artwork: string;
  booklet: string;
  audio: string;
  lyrics: string;
  checksums: string;
  fingerprint: string;
  audit: string;
  package: string;
}>;

export type PackageContextInput = Readonly<{
  packageId: string;
  release: UniversalRelease;
  outputPath: string;
  workspacePath: string;
  version: PackageVersion;
  compression?: PackageCompressionKind;
  encryption?: PackageEncryptionKind;
  signed?: boolean;
  metadata?: Record<string, unknown>;
  artifacts?: readonly PackageArtifact[];
}>;

export type PackageResultDocument = Readonly<{
  packageId: string;
  releaseId: string;
  version: PackageVersion;
  fingerprint: string;
  checksum: string;
  outputPath: string;
  workspacePath: string;
  manifestPath: string;
  createdAt: string;
  files: readonly PackageFileEntry[];
  metadata: Readonly<Record<string, unknown>>;
}>;

export type PackageResult = PackageResultDocument;

export type PackageValidationIssue = Readonly<{
  path: string;
  code: string;
  message: string;
  severity: "error" | "warning";
  value: unknown;
}>;

export type PackageValidationResult = Readonly<{
  valid: boolean;
  errors: readonly PackageValidationIssue[];
  warnings: readonly PackageValidationIssue[];
  metadata: Readonly<Record<string, unknown>>;
}>;

export type PackageMetricSnapshot = Readonly<{
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  files: number;
  bytes: number;
  resumed: boolean;
  metadata: Readonly<Record<string, unknown>>;
}>;
