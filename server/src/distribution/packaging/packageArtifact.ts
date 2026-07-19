import type { PackageArtifact, PackageArtifactKind, PackageSource } from "./packageTypes";

export class PackageArtifactFactory {
  static file(path: string, kind: PackageArtifactKind, sourcePath: string, mediaType: string | null = null, metadata: Readonly<Record<string, unknown>> = {}): PackageArtifact {
    return Object.freeze({
      path,
      kind,
      source: Object.freeze({ type: "file", path: sourcePath }) as PackageSource,
      mediaType,
      size: null,
      checksum: null,
      metadata: Object.freeze({ ...metadata }),
    });
  }

  static text(path: string, kind: PackageArtifactKind, text: string, mediaType: string | null = "application/json", metadata: Readonly<Record<string, unknown>> = {}): PackageArtifact {
    return Object.freeze({
      path,
      kind,
      source: Object.freeze({ type: "text", text }) as PackageSource,
      mediaType,
      size: Buffer.byteLength(text),
      checksum: null,
      metadata: Object.freeze({ ...metadata }),
    });
  }
}
